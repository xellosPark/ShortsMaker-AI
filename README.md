# 🎬 ShortsMaker AI

5분 완성 유튜브 쇼츠 자동 생성기. Synology NAS에서 무료로 돌리는 것이 목표예요.

| 폴더 | 내용 |
|---|---|
| `shorts-server` | NestJS API (`/api/health`), 이후 TypeORM + PostgreSQL, BullMQ(Redis), FFmpeg 렌더 |
| `shorts-web` | Vite + React 19 웹, nginx로 서빙하고 `/api`는 서버로 프록시 |
| `docker-compose.yml` | NAS 배포용 (postgres, redis, api, web) |

## 로컬 개발

```bash
npm --prefix shorts-server install && npm --prefix shorts-server run start:dev   # :3000
npm --prefix shorts-web install && npm --prefix shorts-web run dev               # :5173 (/api → :3000)
```

## NAS 배포

```bash
cp .env.example .env    # POSTGRES_PASSWORD 입력
docker compose up -d --build
```

웹: `http://<NAS IP>:8090`, 상태 확인: `http://<NAS IP>:8090/api/health`
