import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** 무료 음성: 지금은 Windows 내장 음성(SAPI, 한국어 Heami)만 지원 */
export const ttsAvailable = (): boolean => process.platform === 'win32';

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

/** texts[i] → dir/voice-i.wav, 각 파일의 길이(초)를 돌려준다 */
export async function synthesize(dir: string, texts: string[]): Promise<number[]> {
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
