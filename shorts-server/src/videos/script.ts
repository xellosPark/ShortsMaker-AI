import { SAMPLE_TOPICS } from './samples.js';
import type { Scene, ScriptSource } from './video.types.js';

export const PALETTES: [string, string][] = [
  ['0x4c1d95', '0xdb2777'],
  ['0x0f766e', '0x1e3a8a'],
  ['0x9a3412', '0x7e22ce'],
  ['0x1e40af', '0x0891b2'],
  ['0x831843', '0xea580c'],
  ['0x14532d', '0x0e7490'],
];

export interface BuiltScript {
  topic: string;
  emoji: string;
  scriptSource: ScriptSource;
  scenes: Scene[];
  palette: [string, string];
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * 주제로 대본을 만든다.
 * - 비어 있으면 샘플 주제 중 하나를 고른다.
 * - 샘플과 같은 주제면 샘플 대본을 쓴다.
 * - 그 밖에는 기본 틀 대본 (AI 대본은 다음 단계에서 연결)
 */
export function buildScript(rawTopic?: string): BuiltScript {
  const topic = rawTopic?.trim() ?? '';
  const sample = topic
    ? SAMPLE_TOPICS.find((s) => s.topic === topic)
    : pick(SAMPLE_TOPICS);
  const palette = pick(PALETTES);

  if (sample) {
    return {
      topic: sample.topic,
      emoji: sample.emoji,
      scriptSource: 'sample',
      scenes: sample.scenes.map((s) => ({ ...s })),
      palette,
    };
  }

  return {
    topic,
    emoji: '🎬',
    scriptSource: 'template',
    palette,
    scenes: [
      { label: '', title: topic, keyword: 'abstract light', caption: `${topic}, 딱 30초만 투자해 보세요.` },
      { label: 'POINT 1', title: '왜 중요할까?', keyword: 'thinking person', caption: `먼저 ${topic}이(가) 왜 중요한지부터 짚어 볼게요.` },
      { label: 'POINT 2', title: '핵심 한 가지', keyword: 'focus', caption: '가장 중요한 핵심은 단 하나, 꾸준함이에요.' },
      { label: 'POINT 3', title: '바로 해 보기', keyword: 'start running', caption: '오늘 바로 작은 것 하나부터 실천해 보세요.' },
      { label: '', title: '구독하고 더 보기', keyword: 'smartphone hand', caption: '도움이 됐다면 저장하고 구독해 주세요.' },
    ],
  };
}
