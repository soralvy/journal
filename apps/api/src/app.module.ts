import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { AuthModule } from './app/auth/auth.module';
import { PrismaModule } from './app/prisma/prisma.module';
import { UserModule } from './app/user/user.module';
import { JournalModule } from './app/journal/journal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
        genReqId: (req) => req.id,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
      forRoutes: [{ path: '(.*)', method: RequestMethod.ALL }],
    }),
    UserModule,
    AuthModule,
    JournalModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
  ],
})
export class AppModule {}
