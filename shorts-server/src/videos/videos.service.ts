import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { generateScript, geminiAvailable } from './gemini.js';
import { fetchBackground, pexelsAvailable } from './pexels.js';
import { concatScenes, renderScene } from './render.js';
import { buildScript } from './script.js';
import { synthesize, type VoiceId } from './tts.js';
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
      if (id.startsWith('_')) continue;
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
    if (v.status === 'queued' || v.status === 'rendering') throw new ConflictException('만드는 중인 영상은 지울 수 없어요.');
    // Windows 에서 재생 중이던 파일이 잠깐 잠겨 있을 수 있어 몇 번 다시 시도
    await rm(join(MEDIA_DIR, id), { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    this.videos.delete(id);
  }

  create(topic: string | undefined, voice: VoiceId | null): VideoMeta {
    const script = buildScript(topic);
    const meta: VideoMeta = {
      id: randomUUID().slice(0, 8),
      topic: script.topic,
      emoji: script.emoji,
      scriptSource: script.scriptSource,
      voice,
      notes: [],
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
      const notes = meta.notes ?? [];
      await this.update(meta, { status: 'rendering', progress: 3, step: '대본 준비' });

      // 1) 직접 적은 주제 → Gemini 로 주제에 맞는 대본
      if (meta.scriptSource === 'template') {
        if (geminiAvailable()) {
          await this.update(meta, { progress: 5, step: 'AI가 대본 쓰는 중' });
          try {
            const ai = await generateScript(meta.topic);
            await this.update(meta, { scenes: ai.scenes, emoji: ai.emoji, scriptSource: 'ai' });
            this.log.log(`script by ${ai.model}`);
          } catch (e) {
            notes.push(`AI 대본을 만들지 못해 기본 대본을 썼어요. (${e instanceof Error ? e.message : e})`);
          }
        } else {
          notes.push('Gemini 키가 없어 기본 대본을 썼어요.');
        }
      }

      // 2) 음성
      let durations: number[];
      if (meta.voice) {
        await this.update(meta, { progress: 12, step: '음성 만드는 중' });
        const { durations: voiceLens, engine } = await synthesize(work, meta.scenes.map((s) => s.caption), meta.voice as VoiceId);
        if (engine !== 'edge') notes.push('Edge 음성에 연결하지 못해 Windows 음성으로 만들었어요.');
        meta.voiceEngine = engine;
        durations = voiceLens.map((d) => Math.max(2.5, d + 0.65));
      } else {
        durations = meta.scenes.map((s) => Math.max(3, s.caption.length * 0.11 + 1.4));
      }
      durations = durations.map((d) => Math.round(d * 30) / 30);
      meta.scenes.forEach((s, i) => (s.durationSec = durations[i]));
      const total = durations.reduce((a, b) => a + b, 0);

      // 3) 장면별 배경 스톡 영상
      const bgFiles: (string | undefined)[] = meta.scenes.map(() => undefined);
      if (pexelsAvailable()) {
        await this.update(meta, { progress: 22, step: '배경 영상 찾는 중' });
        const used = new Set<string>();
        for (const [i, scene] of meta.scenes.entries()) {
          const keywords = scene.keywords?.length ? scene.keywords : scene.keyword ? [scene.keyword] : [];
          if (!keywords.length) continue;
          try {
            const bg = await fetchBackground(keywords, join(MEDIA_DIR, '_cache'), used);
            if (bg) {
              used.add(bg.id);
              bgFiles[i] = bg.file;
              scene.bgCredit = bg.credit;
              scene.keyword = bg.keyword;
            }
          } catch (e) {
            this.log.warn(`stock "${scene.keyword}": ${e instanceof Error ? e.message : e}`);
          }
        }
        const found = bgFiles.filter(Boolean).length;
        if (found < meta.scenes.length)
          notes.push(`주제에 맞는 배경 영상을 ${meta.scenes.length}개 중 ${found}개만 찾아서, 나머지는 엉뚱한 영상 대신 그라데이션으로 채웠어요.`);
        meta.background = found > 0 ? 'stock' : 'gradient';
      } else {
        meta.background = 'gradient';
        notes.push('스톡 영상 키(Pixabay 또는 Pexels)가 없어 그라데이션 배경을 썼어요.');
      }
      meta.notes = notes;

      // 4) 장면 렌더링
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
            bgFile: bgFiles[index],
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
