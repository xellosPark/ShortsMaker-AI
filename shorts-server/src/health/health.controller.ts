import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  service: 'shorts-server';
  uptimeSec: number;
  time: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'shorts-server',
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  }
}
