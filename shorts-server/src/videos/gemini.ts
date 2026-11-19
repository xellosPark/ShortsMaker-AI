import type { Scene } from './video.types.js';

export const geminiAvailable = () => Boolean(process.env.GEMINI_API_KEY);

/** 앞에서부터 시도할 모델 (GEMINI_MODEL 을 지정하면 그걸 먼저) */
const CANDIDATES = () =>
  [process.env.GEMINI_MODEL, 'gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-flash-latest'].filter(
    (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i,
  );

const PROMPT = (topic: string) => `너는 조회수가 높은 한국어 유튜브 쇼츠 대본 작가야.
주제: "${topic}"

아래 규칙으로 30초 안팎 쇼츠 대본을 만들어.
- 장면은 정확히 5개: 1번은 시청자를 붙잡는 훅, 2~4번은 핵심 포인트 3개, 5번은 마무리(저장·댓글 유도)
- title: 화면 가운데 큰 글씨. 12자 이내, 짧고 강하게
- caption: 내레이션 문장. 자연스러운 구어체 존댓말, 한두 문장, 45자 이내
- label: 1번·5번은 빈 문자열, 2~4번은 "POINT 1"~"POINT 3" (단계 설명이면 "STEP 1"~"STEP 3")
- keywords: 그 장면 배경으로 깔 실사 스톡 영상 검색어 3개 (영어, 각 2~3단어). 첫 번째가 가장 정확한 것, 뒤로 갈수록 더 흔하고 넓은 표현.
  화면에 실제로 보이는 사람·사물·행동으로 쓸 것 (예: ["woman scrubbing back shower", "shower body wash", "bathroom shower"]).
  여러 뜻이 있는 단어(brush → 덤불, scrub → 관목)는 뜻이 분명해지게 다른 단어와 함께 쓸 것. 추상어(success, health, glow, energy)나 감정어만 쓰지 말 것
- 사실과 다른 내용, 과장된 의학·투자 조언은 쓰지 마
- emoji: 주제를 나타내는 이모지 1개`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    emoji: { type: 'STRING' },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          title: { type: 'STRING' },
          caption: { type: 'STRING' },
          keywords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['label', 'title', 'caption', 'keywords'],
      },
    },
  },
  required: ['emoji', 'scenes'],
};

const API = 'https://generativelanguage.googleapis.com/v1beta';
const headers = () => ({ 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' });
/** 마지막으로 성공한 모델 (다음엔 이것부터) */
let lastGood: string | null = null;

/** 모델을 바꿔 가며 시도할 만한 오류: 없음(404) · 사용량 초과(429) · 서버 오류(5xx) · 시간 초과 */
class Retryable extends Error {}

export async function generateScript(topic: string): Promise<{ emoji: string; scenes: Scene[]; model: string }> {
  const order = lastGood ? [lastGood, ...CANDIDATES().filter((m) => m !== lastGood)] : CANDIDATES();
  const errors: string[] = [];
  for (const model of order) {
    try {
      const result = await generateWith(model, topic);
      lastGood = model;
      return { ...result, model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${model}: ${msg.slice(0, 80)}`);
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      if (!(e instanceof Retryable) && !timeout) break;
    }
  }
  throw new Error(errors.join(' / '));
}

/** Gemini 로 주제에 맞는 대본을 만든다 (무료 사용량 안에서 무료) */
async function generateWith(model: string, topic: string): Promise<{ emoji: string; scenes: Scene[] }> {
  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT(topic) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = `Gemini 오류 ${res.status}: ${body?.error?.message ?? ''}`;
    if (res.status === 404 || res.status === 429 || res.status >= 500) throw new Retryable(msg);
    throw new Error(msg);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답이 비어 있어요.');
  const parsed = JSON.parse(text) as { emoji?: string; scenes?: Scene[] };
  const scenes = (parsed.scenes ?? [])
    .filter((s) => s.title?.trim() && s.caption?.trim())
    .slice(0, 6)
    .map((s) => {
      const keywords = (s.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 3);
      return { label: s.label?.trim() ?? '', title: s.title.trim(), caption: s.caption.trim(), keyword: keywords[0], keywords };
    });
  if (scenes.length < 3) throw new Error('Gemini 가 장면을 충분히 만들지 못했어요.');
  return { emoji: parsed.emoji?.trim() || '🎬', scenes };
}
