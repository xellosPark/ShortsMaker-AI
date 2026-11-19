import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * 장면 배경용 무료 스톡 영상.
 * - Pexels (PEXELS_API_KEY) — 2026-11 현재 새 키 발급이 멈춰 있음
 * - Pixabay (PIXABAY_API_KEY) — 가입하면 바로 키가 나옴
 * 둘 다 있으면 Pexels 먼저, 못 찾으면 Pixabay.
 */
export const pexelsAvailable = () => Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);
export const stockProviders = () =>
  [process.env.PEXELS_API_KEY && 'Pexels', process.env.PIXABAY_API_KEY && 'Pixabay'].filter(Boolean) as string[];

interface Candidate {
  /** 'pexels-123' 처럼 출처까지 붙인 id */
  id: string;
  url: string;
  width: number;
  height: number;
  credit: string;
  /** 검색어와 얼마나 맞는지 볼 태그 (소문자) */
  tags: string;
}

/* ── Pexels ── */

interface PexelsVideo {
  id: number;
  duration: number;
  url: string;
  user: { name: string };
  video_files: { link: string; width: number | null; height: number | null; file_type: string }[];
}

async function searchPexels(keyword: string): Promise<Candidate[]> {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', keyword);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '10');
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY ?? '' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pexels 오류 ${res.status}`);
  const { videos } = (await res.json()) as { videos: PexelsVideo[] };
  return videos
    .filter((v) => v.duration >= 4)
    .flatMap((v) => {
      const f = v.video_files
        .filter((x) => x.file_type === 'video/mp4' && x.width && x.height && x.height > x.width && x.height >= 1280)
        .sort((a, b) => Math.abs((a.height ?? 0) - 1920) - Math.abs((b.height ?? 0) - 1920))[0];
      return f ? [{ id: `pexels-${v.id}`, url: f.link, width: f.width!, height: f.height!, credit: `${v.user.name} / Pexels`, tags: v.url.toLowerCase().replace(/[^a-z]+/g, ' ') }] : [];
    });
}

/* ── Pixabay ── */

interface PixabayFile {
  url: string;
  width: number;
  height: number;
}
interface PixabayHit {
  id: number;
  duration: number;
  user: string;
  tags: string;
  videos: Partial<Record<'large' | 'medium' | 'small' | 'tiny', PixabayFile>>;
}

async function searchPixabay(keyword: string): Promise<Candidate[]> {
  const url = new URL('https://pixabay.com/api/videos/');
  url.searchParams.set('key', process.env.PIXABAY_API_KEY ?? '');
  url.searchParams.set('q', keyword.slice(0, 100));
  url.searchParams.set('per_page', '20');
  url.searchParams.set('safesearch', 'true');
  // 실사 영상만 (애니메이션 · 그래픽 제외)
  url.searchParams.set('video_type', 'film');
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pixabay 오류 ${res.status}`);
  const { hits } = (await res.json()) as { hits: PixabayHit[] };
  const list = hits
    .filter((h) => h.duration >= 4)
    .flatMap((h) => {
      // 너무 큰 4K 는 피하고, 세로 1280px 이상이거나 가로 FHD 이상인 파일
      const f = [h.videos.medium, h.videos.large, h.videos.small].find(
        (x): x is PixabayFile => Boolean(x?.url) && (x!.height >= 1280 || x!.width >= 1920) && x!.width <= 2560,
      );
      return f ? [{ id: `pixabay-${h.id}`, url: f.url, width: f.width, height: f.height, credit: `${h.user} / Pixabay`, tags: h.tags.toLowerCase() }] : [];
    });
  // 세로 영상을 먼저 (가로 영상은 가운데를 9:16 으로 잘라 씀)
  return [...list.filter((c) => c.height > c.width), ...list.filter((c) => c.height <= c.width)];
}

const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'with', 'and', 'for', 'to', 'at', 'up']);

/** 검색어 단어가 태그에 몇 개나 들어 있는지 (앞 4글자로 비교해 brushing/brush 같은 변형도 인정) */
export function matchScore(keyword: string, tags: string): number {
  const words = keyword.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1 && !STOP.has(w));
  const tagWords = tags.split(/[^a-z]+/).filter(Boolean);
  return words.filter((w) => tagWords.some((t) => t.startsWith(w.slice(0, 4)) || (t.length >= 4 && w.startsWith(t.slice(0, 4))))).length;
}

/** 통과 기준: 검색어 단어가 2개 이상이면 2개, 1개면 1개 */
const needed = (keyword: string) =>
  Math.min(2, keyword.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1 && !STOP.has(w)).length);

/**
 * 검색어(여러 개면 앞에서부터)로 스톡 영상을 찾아 cacheDir 에 받아 둔다. (받은 파일은 재사용)
 * 태그가 검색어와 충분히 겹치는 영상만 쓰고, 없으면 다음 검색어 → 그래도 없으면 null (그라데이션)
 * exclude: 이미 다른 장면에 쓴 영상 id (같은 영상이 반복되지 않게)
 */
export async function fetchBackground(
  keywords: string[],
  cacheDir: string,
  exclude: Set<string>,
): Promise<{ file: string; id: string; credit: string; keyword: string } | null> {
  const errors: string[] = [];
  let tried = 0;
  for (const keyword of keywords.filter(Boolean)) {
    const searches = [
      process.env.PEXELS_API_KEY ? () => searchPexels(keyword) : null,
      process.env.PIXABAY_API_KEY ? () => searchPixabay(keyword) : null,
    ].filter((s): s is () => Promise<Candidate[]> => s !== null);

    for (const search of searches) {
      tried++;
      let candidates: Candidate[];
      try {
        candidates = await search();
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
        continue;
      }
      const good = candidates
        .map((c) => ({ c, score: matchScore(keyword, c.tags) }))
        .filter(({ c, score }) => !exclude.has(c.id) && score >= needed(keyword))
        .sort((a, b) => b.score - a.score || Number(b.c.height > b.c.width) - Number(a.c.height > a.c.width));
      for (const { c } of good) {
        await mkdir(cacheDir, { recursive: true });
        const file = join(cacheDir, `${c.id}-${c.height}.mp4`);
        if (!existsSync(file)) {
          const dl = await fetch(c.url, { signal: AbortSignal.timeout(60_000) });
          if (!dl.ok || !dl.body) continue;
          const tmp = `${file}.part`;
          await pipeline(Readable.fromWeb(dl.body as never), createWriteStream(tmp));
          await rename(tmp, file);
        }
        return { file, id: c.id, credit: c.credit, keyword };
      }
    }
  }
  if (errors.length && errors.length === tried) throw new Error(errors.join(' / '));
  return null;
}
