# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- run ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 FFMPEG_PATH=/usr/bin/ffmpeg MEDIA_DIR=/data/media
RUN apk add --no-cache ffmpeg font-noto-cjk && mkdir -p /data/media && chown node:node /data/media
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
