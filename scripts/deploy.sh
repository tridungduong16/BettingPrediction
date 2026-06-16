#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ROOT_ENV_FILE="${ROOT_ENV_FILE:-.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-backend/.env}"
BUILD_ARGS=(--build)
PULL_IMAGES=false
SKIP_HEALTHCHECK=false

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Options:
  --no-build               Run containers without rebuilding images.
  --pull                   Pull base/service images before deploying.
  --skip-healthcheck       Skip post-deploy HTTP health checks.
  --web-port PORT          Override FUTBOLIA_WEB_PORT for this deploy.
  --backend-port PORT      Override FUTBOLIA_BACKEND_PORT for this deploy.
  --backend-bind ADDRESS   Override FUTBOLIA_BACKEND_BIND for this deploy.
  -h, --help               Show this help.

Default ports:
  web:     8082 -> 80
  backend: 127.0.0.1:8010 -> 8000
EOF
}

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)
      BUILD_ARGS=()
      shift
      ;;
    --pull)
      PULL_IMAGES=true
      shift
      ;;
    --skip-healthcheck)
      SKIP_HEALTHCHECK=true
      shift
      ;;
    --web-port)
      [[ $# -ge 2 ]] || die "--web-port requires a value"
      export FUTBOLIA_WEB_PORT="$2"
      shift 2
      ;;
    --backend-port)
      [[ $# -ge 2 ]] || die "--backend-port requires a value"
      export FUTBOLIA_BACKEND_PORT="$2"
      shift 2
      ;;
    --backend-bind)
      [[ $# -ge 2 ]] || die "--backend-bind requires a value"
      export FUTBOLIA_BACKEND_BIND="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

cd "$ROOT_DIR"

require_command docker

docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is not available. Install Docker Compose v2."

[[ -f "$COMPOSE_FILE" ]] || die "Missing $COMPOSE_FILE"
[[ -f "$BACKEND_ENV_FILE" ]] || die "Missing $BACKEND_ENV_FILE. Create it from backend/.env.example and fill runtime secrets."

if [[ ! -f "$ROOT_ENV_FILE" ]]; then
  [[ -f .env.example ]] || die "Missing .env.example"
  cp .env.example "$ROOT_ENV_FILE"
  log "Created $ROOT_ENV_FILE from .env.example"
fi

WEB_PORT="${FUTBOLIA_WEB_PORT:-$(awk -F= '$1=="FUTBOLIA_WEB_PORT"{print $2}' "$ROOT_ENV_FILE" 2>/dev/null || true)}"
BACKEND_BIND="${FUTBOLIA_BACKEND_BIND:-$(awk -F= '$1=="FUTBOLIA_BACKEND_BIND"{print $2}' "$ROOT_ENV_FILE" 2>/dev/null || true)}"
BACKEND_PORT="${FUTBOLIA_BACKEND_PORT:-$(awk -F= '$1=="FUTBOLIA_BACKEND_PORT"{print $2}' "$ROOT_ENV_FILE" 2>/dev/null || true)}"

WEB_PORT="${WEB_PORT:-8082}"
BACKEND_BIND="${BACKEND_BIND:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8010}"

log "Using web port: $WEB_PORT"
log "Using backend bind: $BACKEND_BIND:$BACKEND_PORT"

log "Validating compose config"
docker compose -f "$COMPOSE_FILE" config --quiet

if [[ "$PULL_IMAGES" == true ]]; then
  log "Pulling service images"
  docker compose -f "$COMPOSE_FILE" pull --ignore-buildable
fi

log "Deploying containers"
docker compose -f "$COMPOSE_FILE" up -d "${BUILD_ARGS[@]}"

log "Container status"
docker compose -f "$COMPOSE_FILE" ps

if [[ "$SKIP_HEALTHCHECK" == false ]]; then
  require_command curl

  log "Checking backend health"
  curl --fail --silent --show-error "http://${BACKEND_BIND}:${BACKEND_PORT}/health" >/dev/null

  log "Checking web health"
  curl --fail --silent --show-error "http://127.0.0.1:${WEB_PORT}/healthz" >/dev/null
fi

log "Deploy complete: http://SERVER_IP:${WEB_PORT}"
