import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { concatScenes, renderScene } from './render.js';
import { buildScript } from './script.js';
import { synthesize, ttsAvailable } from './tts.js';
import type { VideoMeta } from './video.types.js';

export const MEDIA_DIR = resolve(process.env.MEDIA_DIR ?? 'media');

@Injectable()
export class VideosService implements OnModuleInit {
  private readonly log = new Logger(VideosService.name);
  private readonly videos = new Map<string, VideoMeta>();
  /** 렌더링은 한 번에 하나씩 (나중에 BullMQ 로 교체) */
  private queue: Promise<void> = Promise.resolve();

  async onModuleInit() {
    await mkdir(MEDIA_DIR, { recursive: true });
    for (const id of await readdir(MEDIA_DIR)) {
      try {
        const meta = JSON.parse(await readFile(join(MEDIA_DIR, id, 'meta.json'), 'utf8')) as VideoMeta;
        if (meta.status === 'queued' || meta.status === 'rendering') {
          meta.status = 'failed';
          meta.error = '서버가 다시 시작돼서 중단됐어요.';
        }
        this.videos.set(meta.id, meta);
      } catch {
        /* meta.json 없는 폴더는 무시 */
      }
    }
    this.log.log(`media: ${MEDIA_DIR} (${this.videos.size}개)`);
  }

  list(): VideoMeta[] {
    return [...this.videos.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): VideoMeta {
    const v = this.videos.get(id);
    if (!v) throw new NotFoundException('영상을 찾을 수 없어요.');
    return v;
  }

  async remove(id: string) {
    const v = this.get(id);
    if (v.status === 'queued' || v.status === 'rendering') return;
    this.videos.delete(id);
    await rm(join(MEDIA_DIR, id), { recursive: true, force: true });
  }

  create(topic: string | undefined, voice: boolean): VideoMeta {
    const script = buildScript(topic);
    const meta: VideoMeta = {
      id: randomUUID().slice(0, 8),
      topic: script.topic,
      emoji: script.emoji,
      scriptSource: script.scriptSource,
      voice: voice && ttsAvailable(),
      palette: script.palette,
      status: 'queued',
      progress: 0,
      step: '대기 중',
      scenes: script.scenes,
      createdAt: new Date().toISOString(),
    };
    this.videos.set(meta.id, meta);
    this.queue = this.queue.then(() => this.render(meta));
    return meta;
  }

  private async update(meta: VideoMeta, patch: Partial<VideoMeta>) {
    Object.assign(meta, patch);
    await writeFile(join(MEDIA_DIR, meta.id, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  }

  private async render(meta: VideoMeta) {
    const dir = join(MEDIA_DIR, meta.id);
    const work = join(dir, 'work');
    await mkdir(work, { recursive: true });
    const started = Date.now();
    try {
      await this.update(meta, { status: 'rendering', progress: 5, step: '대본 준비' });

      let durations: number[];
      if (meta.voice) {
        await this.update(meta, { progress: 10, step: '음성 만드는 중' });
        const voiceLens = await synthesize(work, meta.scenes.map((s) => s.caption));
        durations = voiceLens.map((d) => Math.max(2.5, d + 0.65));
      } else {
        durations = meta.scenes.map((s) => Math.max(3, s.caption.length * 0.11 + 1.4));
      }
      durations = durations.map((d) => Math.round(d * 30) / 30);
      meta.scenes.forEach((s, i) => (s.durationSec = durations[i]));
      const total = durations.reduce((a, b) => a + b, 0);

      const segments: string[] = [];
      let start = 0;
      for (const [index, scene] of meta.scenes.entries()) {
        await this.update(meta, {
          progress: Math.round(30 + (index / meta.scenes.length) * 60),
          step: `장면 ${index + 1}/${meta.scenes.length} 렌더링`,
        });
        segments.push(
          await renderScene({
            dir: work,
            index,
            total: meta.scenes.length,
            scene,
            duration: durations[index],
            start,
            videoDuration: total,
            palette: meta.palette,
            voiceFile: meta.voice ? `voice-${index}.wav` : undefined,
          }),
        );
        start += durations[index];
      }

      await this.update(meta, { progress: 95, step: '합치는 중' });
      await concatScenes(work, segments, join('..', 'video.mp4'));
      await rm(work, { recursive: true, force: true });

      await this.update(meta, {
        status: 'done',
        progress: 100,
        step: '완료',
        videoUrl: `/api/media/${meta.id}/video.mp4`,
        durationSec: Math.round(total * 10) / 10,
        finishedAt: new Date().toISOString(),
      });
      this.log.log(`done ${meta.id} "${meta.topic}" ${total.toFixed(1)}s in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.error(`failed ${meta.id}: ${message}`);
      await this.update(meta, { status: 'failed', step: '실패', error: message });
    }
  }
}
