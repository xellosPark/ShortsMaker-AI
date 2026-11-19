export interface Scene {
  /** 작은 라벨 (예: POINT 1). 비어 있으면 표시하지 않음 */
  label: string;
  /** 화면 가운데 큰 글씨 */
  title: string;
  /** 내레이션 + 하단 자막 */
  caption: string;
  /** 배경 영상 검색어 (영어) */
  keyword?: string;
  /** 배경 검색어 후보 (앞에서부터 시도). 실제로 쓴 검색어는 keyword */
  keywords?: string[];
  /** 배경 영상 출처 (Pexels 촬영자) */
  bgCredit?: string;
  durationSec?: number;
}

export type VideoStatus = 'queued' | 'rendering' | 'done' | 'failed';
export type ScriptSource = 'sample' | 'ai' | 'template';

export interface VideoMeta {
  id: string;
  topic: string;
  emoji: string;
  scriptSource: ScriptSource;
  /** 목소리 id (없으면 자막만) */
  voice: string | null;
  /** 실제로 쓴 음성 엔진 */
  voiceEngine?: string;
  /** 배경: 스톡 영상(stock) 또는 그라데이션(gradient) */
  background?: 'stock' | 'gradient';
  palette: [string, string];
  status: VideoStatus;
  progress: number;
  step: string;
  scenes: Scene[];
  videoUrl?: string;
  durationSec?: number;
  createdAt: string;
  finishedAt?: string;
  error?: string;
  /** 문제는 아니지만 알려 줄 내용 (예: AI 대본 실패 → 기본 대본 사용) */
  notes?: string[];
}
