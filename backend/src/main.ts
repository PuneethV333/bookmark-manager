import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.set('trust proxy', 1);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const frontendUrl = configService
    .get<string>('FRONTEND_URL', 'http://localhost:5173')
    .replace(/\/+$/, '');

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port = configService.get<number>('BACKEND_PORT', 4000);
  await app.listen(port);
  Logger.log(`Backend running on port ${port}`, 'Bootstrap');
}
void bootstrap();
