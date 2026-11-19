export interface Scene {
  /** 작은 라벨 (예: POINT 1). 비어 있으면 표시하지 않음 */
  label: string;
  /** 화면 가운데 큰 글씨 */
  title: string;
  /** 내레이션 + 하단 자막 */
  caption: string;
  durationSec?: number;
}

export type VideoStatus = 'queued' | 'rendering' | 'done' | 'failed';

export interface VideoMeta {
  id: string;
  topic: string;
  emoji: string;
  scriptSource: 'sample' | 'template';
  voice: boolean;
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
}
