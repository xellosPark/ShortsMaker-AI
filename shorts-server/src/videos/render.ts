import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Scene } from './video.types.js';

const W = 1080;
const H = 1920;
const FPS = 30;

function resolveFfmpeg(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static') as string | null;
    if (p && existsSync(p)) return p;
  } catch {
    /* 설치 안 됨 → PATH 의 ffmpeg 사용 */
  }
  return 'ffmpeg';
}

function resolveFont(): string {
  const candidates = [
    process.env.FONT_PATH,
    'C:/Windows/Fonts/malgunbd.ttf',
    '/usr/share/fonts/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('한글 폰트를 찾지 못했어요. FONT_PATH 를 설정해 주세요.');
  return found;
}

export const FFMPEG = resolveFfmpeg();

/** 한글 줄바꿈: 띄어쓰기 기준, 한 줄 maxChars 글자 */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
    while (line.length > maxChars) {
      lines.push(line.slice(0, maxChars));
      line = line.slice(maxChars);
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function ffmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd, windowsHide: true });
    let err = '';
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 실패 (${code}): ${err.slice(-800)}`))));
  });
}

export interface SceneRenderInput {
  dir: string;
  index: number;
  total: number;
  scene: Scene;
  duration: number;
  /** 이 장면이 전체 영상에서 시작하는 시각(초) */
  start: number;
  videoDuration: number;
  palette: [string, string];
  voiceFile?: string;
  /** 배경 스톡 영상 (없으면 그라데이션) */
  bgFile?: string;
}

/** 장면 하나를 seg-i.mp4 로 렌더링 */
export async function renderScene(i: SceneRenderInput): Promise<string> {
  const { dir, index, scene, duration: D } = i;
  // 필터 문법에서 'C:' 같은 경로 이스케이프 문제를 피하려고 작업 폴더에 복사해서 상대 경로로 쓴다
  const font = 'font.ttf';
  if (!existsSync(join(dir, font))) await copyFile(resolveFont(), join(dir, font));
  const txt = async (name: string, value: string) => {
    await writeFile(join(dir, name), value, 'utf8');
    return name;
  };
  const dt = (opts: string) => `drawtext=fontfile='${font}':${opts}`;

  const filters: string[] = [];
  // 상단 진행 바
  filters.push(`drawbox=x=0:y=48:w=iw:h=10:color=white@0.25:t=fill`);
  // 브랜드 / 장면 번호
  filters.push(dt(`textfile='${await txt(`b-${index}.txt`, 'ShortsMaker AI')}':fontsize=38:fontcolor=white@0.85:x=64:y=104`));
  filters.push(
    dt(`textfile='${await txt(`n-${index}.txt`, `${String(index + 1).padStart(2, '0')} / ${String(i.total).padStart(2, '0')}`)}':fontsize=38:fontcolor=white@0.85:x=w-tw-64:y=104`),
  );

  // 가운데 큰 제목 (아래에서 올라오며 나타남)
  const titleLines = wrap(scene.title, 9);
  const lineH = 132;
  const blockTop = 820 - (titleLines.length * lineH) / 2;
  const ease = `min(1,t/0.45)`;
  if (scene.label) {
    filters.push(
      dt(
        `textfile='${await txt(`l-${index}.txt`, scene.label)}':fontsize=46:fontcolor=0xfde68a:x=(w-tw)/2:y='${blockTop - 90}+40*(1-${ease})':alpha='${ease}'`,
      ),
    );
  }
  for (const [li, line] of titleLines.entries()) {
    filters.push(
      dt(
        `textfile='${await txt(`t-${index}-${li}.txt`, line)}':fontsize=108:fontcolor=white:shadowcolor=black@0.35:shadowx=0:shadowy=6:x=(w-tw)/2:y='${blockTop + li * lineH}+60*(1-${ease})':alpha='${ease}'`,
      ),
    );
  }

  // 하단 자막
  const capLines = wrap(scene.caption, 16);
  const capH = 76;
  const boxH = capLines.length * capH + 56;
  const boxY = 1500 - boxH / 2;
  filters.push(`drawbox=x=64:y=${boxY}:w=${W - 128}:h=${boxH}:color=black@0.45:t=fill`);
  for (const [ci, line] of capLines.entries()) {
    filters.push(
      dt(`textfile='${await txt(`c-${index}-${ci}.txt`, line)}':fontsize=54:fontcolor=white:x=(w-tw)/2:y=${boxY + 34 + ci * capH}`),
    );
  }
  filters.push(`fade=t=in:st=0:d=0.25`, `fade=t=out:st=${(D - 0.25).toFixed(2)}:d=0.25`);

  const [c0, c1] = i.palette;
  // 스톡 영상은 9:16 으로 꽉 채워 자르고, 글씨가 잘 보이게 살짝 어둡게
  const bgChain = i.bgFile
    ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.38:t=fill[bg0];[bg0]`
    : `[0:v]`;
  const graph = [
    `${bgChain}[2:v]overlay=x='-w+w*(${i.start.toFixed(3)}+t)/${i.videoDuration.toFixed(3)}':y=48,${filters.join(',')},format=yuv420p[v]`,
    i.voiceFile
      ? `[1:a]aresample=44100,adelay=250:all=1,apad,atrim=0:${D.toFixed(3)}[a]`
      : `[1:a]atrim=0:${D.toFixed(3)}[a]`,
  ].join(';\n');
  const graphFile = await txt(`g-${index}.txt`, graph);

  const out = `seg-${index}.mp4`;
  await ffmpeg(
    [
      ...(i.bgFile
        ? ['-stream_loop', '-1', '-i', i.bgFile]
        : ['-f', 'lavfi', '-i', `gradients=s=${W}x${H}:r=${FPS}:d=${D.toFixed(3)}:n=2:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=${W}:y1=${H}:speed=0.015`]),
      ...(i.voiceFile ? ['-i', i.voiceFile] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']),
      '-f', 'lavfi', '-i', `color=c=white@0.95:s=${W}x10:r=${FPS}:d=${D.toFixed(3)}`,
      '-filter_complex_script', graphFile,
      '-map', '[v]', '-map', '[a]',
      '-t', D.toFixed(3),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      out,
    ],
    dir,
  );
  return out;
}

/** seg-*.mp4 들을 하나로 이어 붙인다 */
export async function concatScenes(dir: string, segments: string[], outFile: string): Promise<void> {
  await writeFile(join(dir, 'list.txt'), segments.map((s) => `file '${s}'`).join('\n'), 'utf8');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', outFile], dir);
}
