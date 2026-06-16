# Docker deploy

This compose file avoids the ports currently used on the target server:

- Web: `8082 -> 80`
- Backend debug access: `127.0.0.1:8010 -> 8000`

## Prepare env

Keep backend runtime secrets in `backend/.env`. If `BIFROST_ENDPOINT_URL` points to a Bifrost
container published on the same Docker host, use the host gateway address from inside this app:

```env
BIFROST_ENDPOINT_URL=http://host.docker.internal:8081/v1
```

Optionally create a root `.env` from `.env.example` to override public deploy ports:

```bash
cp .env.example .env
```

## Run

```bash
scripts/deploy.sh
```

Useful options:

```bash
scripts/deploy.sh --pull
scripts/deploy.sh --web-port 8083 --backend-port 8011
scripts/deploy.sh --no-build
```

Open the app at:

```text
http://SERVER_IP:8082
```

Backend health is available from the server host only:

```bash
curl http://127.0.0.1:8010/health
```

Backend cache and live fixture data are stored in the `futbolia-backend-data` Docker volume. To
seed a live fixture map after creating `backend/data/live_fixture_map.json`, copy it into the
running backend container:

```bash
docker compose cp backend/data/live_fixture_map.json backend:/app/data/live_fixture_map.json
```
