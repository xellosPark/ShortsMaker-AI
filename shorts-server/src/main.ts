import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { MEDIA_DIR } from './videos/videos.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  mkdirSync(MEDIA_DIR, { recursive: true });
  app.useStaticAssets(MEDIA_DIR, { prefix: '/api/media/', index: false });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`shorts-server listening on :${port}`);
}
await bootstrap();
