import { execFile } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ffmpeg } from './render.js';

const run = promisify(execFile);

/** 선택할 수 있는 목소리 (Edge 신경망 음성, 무료 · 키 불필요 · 인터넷 필요) */
export const VOICES = [
  { id: 'sunhi', name: '선히', desc: '밝은 여성', edge: 'ko-KR-SunHiNeural' },
  { id: 'injoon', name: '인준', desc: '차분한 남성', edge: 'ko-KR-InJoonNeural' },
  { id: 'hyunsu', name: '현수', desc: '부드러운 남성', edge: 'ko-KR-HyunsuMultilingualNeural' },
] as const;

export type VoiceId = (typeof VOICES)[number]['id'];
export const DEFAULT_VOICE: VoiceId = 'sunhi';
export const isVoiceId = (v: unknown): v is VoiceId => VOICES.some((x) => x.id === v);

/**
 * texts[i] → dir/voice-i.wav (44.1kHz), 각 파일 길이(초)를 돌려준다.
 * Edge 음성이 실패하면 (Windows 에서는) 내장 음성으로 대신 만든다.
 */
export async function synthesize(dir: string, texts: string[], voice: VoiceId): Promise<{ durations: number[]; engine: string }> {
  try {
    const durations = await synthesizeEdge(dir, texts, voice);
    return { durations, engine: 'edge' };
  } catch (e) {
    if (process.platform !== 'win32') throw e;
    const durations = await synthesizeSapi(dir, texts);
    return { durations, engine: 'windows' };
  }
}

async function synthesizeEdge(dir: string, texts: string[], voice: VoiceId): Promise<number[]> {
  const edgeName = VOICES.find((v) => v.id === voice)!.edge;
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(edgeName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    for (const [i, text] of texts.entries()) {
      const mp3 = join(dir, `voice-${i}.mp3`);
      const { audioStream } = tts.toStream(text, { rate: '+8%' });
      await pipeline(audioStream, createWriteStream(mp3));
      // 앞뒤 무음을 살짝 다듬고 44.1kHz WAV 로 변환
      await ffmpeg(
        ['-i', `voice-${i}.mp3`, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-ar', '44100', '-ac', '1', `voice-${i}.wav`],
        dir,
      );
    }
  } finally {
    tts.close();
  }
  return Promise.all(texts.map((_, i) => wavDuration(join(dir, `voice-${i}.wav`))));
}

/** 목소리 미리듣기용 짧은 mp3 (처음 한 번 만들고 캐시) */
export async function voicePreview(voice: VoiceId, cacheDir: string): Promise<string> {
  const file = join(cacheDir, `preview-${voice}.mp3`);
  if (existsSync(file)) return file;
  await mkdir(cacheDir, { recursive: true });
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICES.find((v) => v.id === voice)!.edge, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream('안녕하세요! 오늘도 30초 만에 꿀팁 하나 알려 드릴게요.', { rate: '+8%' });
    await pipeline(audioStream, createWriteStream(`${file}.part`));
    await rename(`${file}.part`, file);
  } finally {
    tts.close();
  }
  return file;
}

/* ── 예비: Windows 내장 음성 (SAPI) ── */

const PS_SCRIPT = `
param([string]$JobFile)
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 $JobFile | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$ko = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'ko-KR' } | Select-Object -First 1
if ($ko) { $s.SelectVoice($ko.VoiceInfo.Name) }
$s.Rate = 1
foreach ($it in $items) {
  $s.SetOutputToWaveFile($it.out)
  $s.Speak($it.text)
}
$s.SetOutputToNull()
$s.Dispose()
`;

async function synthesizeSapi(dir: string, texts: string[]): Promise<number[]> {
  const items = texts.map((text, i) => ({ text, out: join(dir, `voice-${i}.wav`) }));
  const jobFile = join(dir, 'tts.json');
  const psFile = join(dir, 'tts.ps1');
  await writeFile(jobFile, JSON.stringify(items), 'utf8');
  await writeFile(psFile, '﻿' + PS_SCRIPT, 'utf8');
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile, jobFile], {
    timeout: 120_000,
    windowsHide: true,
  });
  return Promise.all(items.map((it) => wavDuration(it.out)));
}

/** WAV 헤더에서 길이(초) 계산 */
export async function wavDuration(file: string): Promise<number> {
  const buf = await readFile(file);
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(offset + 16);
    if (id === 'data' && byteRate > 0) return size / byteRate;
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV 길이를 읽지 못했어요: ${file}`);
}
