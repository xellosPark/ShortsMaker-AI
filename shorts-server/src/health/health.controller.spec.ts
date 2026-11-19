import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns status ok', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const res = moduleRef.get(HealthController).check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('shorts-server');
  });
});
