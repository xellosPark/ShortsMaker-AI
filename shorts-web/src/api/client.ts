export interface Scene {
  label: string;
  title: string;
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
  error?: string;
}

export interface AppConfig {
  voiceAvailable: boolean;
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
  create: (topic: string, voice: boolean) =>
    req<VideoMeta>('/videos', { method: 'POST', body: JSON.stringify({ topic, voice }) }),
  remove: (id: string) => req<void>(`/videos/${id}`, { method: 'DELETE' }),
};

/** 0x4c1d95 → #4c1d95 */
export const hex = (c: string) => c.replace(/^0x/, '#');
