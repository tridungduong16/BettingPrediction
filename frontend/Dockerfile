FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_APP_ENV=production
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_PUBLIC_STATICS_URL=
ARG VITE_MATCH_ID=2026-001-mexico-vs-south-africa
ARG VITE_LIVE_DEBUG_LOGS=false
ARG VITE_LIVE_POLLING_INTERVAL_MS=300000

ENV VITE_APP_ENV=${VITE_APP_ENV} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_PUBLIC_STATICS_URL=${VITE_PUBLIC_STATICS_URL} \
    VITE_MATCH_ID=${VITE_MATCH_ID} \
    VITE_LIVE_DEBUG_LOGS=${VITE_LIVE_DEBUG_LOGS} \
    VITE_LIVE_POLLING_INTERVAL_MS=${VITE_LIVE_POLLING_INTERVAL_MS}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
