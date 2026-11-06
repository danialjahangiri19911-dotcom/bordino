# Production deploy (lottery.bordino.co)

What runs on the prod box (194.60.230.57) in `/opt/projects/bordino-lottery/deploy/`, as its own
compose project `bordino-lottery`, beside caffemenu (never touch caffemenu's containers). This folder
is a copy of that directory **without its secrets**; keep the two in step when one changes.

| File | Role |
| --- | --- |
| `compose.yaml` | db (PostgreSQL 17), **pgbouncer** (session pool), redis, web (gunicorn/uvicorn, **4 workers**), worker, beat, front (Next), proxy (Caddy) |
| `Caddyfile` | the proxy: `/api/v1`, `/admin`… → Django; `/_next/static/*` from disk precompressed; the rest → Next; `/media/private` → 404 |
| `sync-next-static.sh` | copies the running front's `/_next/static` (with `.br`/`.gz`) to `data/next` for the proxy |
| `backend.Dockerfile`, `front.Dockerfile` (+ `.dockerignore`) | the images (the front one saves brotli/gzip copies of every script and stylesheet) |
| `backend.env.example`, `.env.example` | the settings files' names and safe values; secrets are blank here and live only on the box |

Not here, on purpose: `.env` (secrets, chmod 600), `backend.env`'s private values (push keys, Sentry
DSN, the admin SMS allowlist), `data/` (media, the synced static files) and the database volume.
TLS for the domain is done by caffemenu's Caddy, which forwards to the alias `lottery-proxy`.

## Build and ship (from the dev box)

```sh
# backend
cd Bordino_Backend-develop/Bordino_Backend-develop
docker build -f ../../deploy/prod/backend.Dockerfile --target runtime --build-arg ENVIRONMENT=prod -t bordino-lottery-backend:NEW .
# frontend (remove .next and .pnpm-store first)
cd ../../Bordino_Frontend-develop/Bordino_Frontend-develop
docker build -f ../../deploy/prod/front.Dockerfile -t lottery-front-devtest:NEW .
# ship
docker save IMAGE | gzip -1 | ssh prod 'gunzip -c | docker load'
```

Before switching: run the backend suite on the new image on prod with a compose override that sets
`web.image`, plus `manage.py migrate --plan`.

## Deploy (on the box)

```sh
cd /opt/projects/bordino-lottery/deploy
docker tag bordino-lottery-backend:latest bordino-lottery-backend:pre-X   # rollback point
docker tag bordino-lottery-front:latest bordino-lottery-front:pre-X
docker tag lottery-front-devtest:NEW bordino-lottery-front:latest && docker compose -p bordino-lottery up -d --no-build front
./sync-next-static.sh          # after EVERY frontend deploy
docker tag bordino-lottery-backend:NEW bordino-lottery-backend:latest && docker compose -p bordino-lottery up -d --no-build web worker beat
```

Frontend first: new frontends tolerate the old backend (extra fields are ignored). The web container
runs `migrate` at start. Without `sync-next-static.sh`, new scripts still work (the proxy falls back to
Next), only not precompressed.

## Rollback

Retag `pre-X` as `latest` and `up -d --no-build` the services. Config backups sit next to the live
files (`compose.yaml.pre-perf`, `Caddyfile.pre-perf`).

## Why PgBouncer

The API is ASGI and opens a database connection per request (`CONN_MAX_AGE=0`). `CONN_MAX_AGE>0` is
not safe under ASGI (each request runs in its own thread, so kept connections leak instead of being
reused), and Django's own pool needs psycopg 3 (only psycopg2 is installed). Session-mode PgBouncer
keeps the app unchanged; PostgreSQL no longer forks a process per request. Load test 2026-11-06:
50 → 64 requests/s, p95 1.54 → 1.09 s, database CPU 123% → 21%.
