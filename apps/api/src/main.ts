/* eslint-disable unicorn/prefer-top-level-await */
import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Http2ServerRequest } from 'node:http2';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      requestIdHeader: 'x-request-id',
      genReqId: (req: IncomingMessage | Http2ServerRequest) => (req.headers['x-request-id'] as string) || randomUUID(),
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableShutdownHooks();

  const config = new DocumentBuilder().setTitle('Journal app').setVersion('1.0').addTag('journal').build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(PinoLogger);
  logger.log(`http://localhost:${port}/api is running`);
}

void bootstrap();
