import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  const frontendUrl = configService.get<string>('FRONTEND_URL');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port = configService.get<number>('BACKEND_PORT', 4000);
  await app.listen(port);
  Logger.log(`Backend running on port ${port}`, 'Bootstrap');
}
void bootstrap();
