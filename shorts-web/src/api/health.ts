export interface HealthResponse {
  status: 'ok';
  service: string;
  uptimeSec: number;
  time: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
