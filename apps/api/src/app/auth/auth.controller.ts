import { All, Controller, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { auth } from './auth.configuration';
import { AuthService } from './auth.service';

@Controller({
  path: 'auth',
  version: VERSION_NEUTRAL,
})
export class AuthController {
  private readonly authHandler = toNodeHandler(auth);

  constructor(private readonly authService: AuthService) {}

  @All('/*')
  async handleAuth(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const protocol = req.protocol;
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body);

    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as HeadersInit,
      body,
    });

    const apiResponse = await auth.handler(request);

    res.status(apiResponse.status);

    for (const [key, value] of apiResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        res.header(key, apiResponse.headers.getSetCookie());
      } else {
        res.header(key, value);
      }
    }

    const responseBody = await apiResponse.text();
    res.send(responseBody);
  }
}
