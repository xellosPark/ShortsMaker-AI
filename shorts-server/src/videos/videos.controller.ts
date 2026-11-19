import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { SAMPLE_TOPICS } from './samples.js';
import { ttsAvailable } from './tts.js';
import { VideosService } from './videos.service.js';

interface CreateVideoBody {
  topic?: unknown;
  voice?: unknown;
}

@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get('config')
  config() {
    return {
      voiceAvailable: ttsAvailable(),
      samples: SAMPLE_TOPICS.map(({ topic, emoji }) => ({ topic, emoji })),
    };
  }

  @Get('videos')
  list() {
    return this.videos.list();
  }

  @Get('videos/:id')
  get(@Param('id') id: string) {
    return this.videos.get(id);
  }

  @Post('videos')
  @HttpCode(202)
  create(@Body() body: CreateVideoBody = {}) {
    const topic = body.topic;
    if (topic !== undefined && typeof topic !== 'string') throw new BadRequestException('topic 은 문자열이어야 해요.');
    if (typeof topic === 'string' && topic.trim().length > 60) throw new BadRequestException('주제는 60자 이내로 적어 주세요.');
    return this.videos.create(topic, body.voice !== false);
  }

  @Delete('videos/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.videos.remove(id);
  }
}
