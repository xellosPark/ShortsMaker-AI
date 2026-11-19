import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'node:path';
import { geminiAvailable } from './gemini.js';
import { pexelsAvailable, stockProviders } from './pexels.js';
import { SAMPLE_TOPICS } from './samples.js';
import { DEFAULT_VOICE, isVoiceId, VOICES, voicePreview } from './tts.js';
import { MEDIA_DIR, VideosService } from './videos.service.js';

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
      voices: VOICES.map(({ id, name, desc }) => ({ id, name, desc })),
      defaultVoice: DEFAULT_VOICE,
      aiScript: geminiAvailable(),
      stockVideo: pexelsAvailable(),
      stockProviders: stockProviders(),
      samples: SAMPLE_TOPICS.map(({ topic, emoji }) => ({ topic, emoji })),
    };
  }

  @Get('voices/:id/preview')
  async preview(@Param('id') id: string, @Res() res: Response) {
    if (!isVoiceId(id)) throw new NotFoundException('없는 목소리예요.');
    res.sendFile(await voicePreview(id, join(MEDIA_DIR, '_cache')));
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
    const voice = body.voice === null || body.voice === 'none' || body.voice === false ? null : isVoiceId(body.voice) ? body.voice : DEFAULT_VOICE;
    return this.videos.create(topic, voice);
  }

  @Delete('videos/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.videos.remove(id);
  }
}
