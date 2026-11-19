import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { VideosController } from './videos/videos.controller.js';
import { VideosService } from './videos/videos.service.js';

@Module({
  imports: [],
  controllers: [HealthController, VideosController],
  providers: [VideosService],
})
export class AppModule {}
