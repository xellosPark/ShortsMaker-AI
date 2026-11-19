export interface Scene {
  label: string;
  title: string;
  caption: string;
  keyword?: string;
  bgCredit?: string;
  durationSec?: number;
}

export type VideoStatus = 'queued' | 'rendering' | 'done' | 'failed';

export interface VideoMeta {
  id: string;
  topic: string;
  emoji: string;
  scriptSource: 'sample' | 'ai' | 'template';
  /** 목소리 id (예전 영상은 true/false) */
  voice: string | boolean | null;
  voiceEngine?: string;
  background?: 'stock' | 'gradient';
  notes?: string[];
  palette: [string, string];
  status: VideoStatus;
  progress: number;
  step: string;
  scenes: Scene[];
  videoUrl?: string;
  durationSec?: number;
  createdAt: string;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  desc: string;
}

export interface AppConfig {
  voices: Voice[];
  defaultVoice: string;
  aiScript: boolean;
  stockVideo: boolean;
  stockProviders: string[];
  samples: { topic: string; emoji: string }[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `요청 실패 (${res.status})`);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

export const api = {
  health: () => req<{ status: string; uptimeSec: number }>('/health'),
  config: () => req<AppConfig>('/config'),
  list: () => req<VideoMeta[]>('/videos'),
  get: (id: string) => req<VideoMeta>(`/videos/${id}`),
  create: (topic: string, voice: string) =>
    req<VideoMeta>('/videos', { method: 'POST', body: JSON.stringify({ topic, voice }) }),
  voicePreviewUrl: (id: string) => `/api/voices/${id}/preview`,
  remove: (id: string) => req<void>(`/videos/${id}`, { method: 'DELETE' }),
};

/** 0x4c1d95 → #4c1d95 */
export const hex = (c: string) => c.replace(/^0x/, '#');
