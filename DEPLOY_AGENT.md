# Kuara — Production Deployment Agent Guide

You are Claude Code running on a **Ubuntu 24.04 production server**. Your job is to get the Kuara platform fully running in production using Docker Compose. Read this file carefully before taking any action.

---

## 1. What Is Kuara?

Kuara is an educational content platform built with:

- **Next.js 15** (App Router) + **React 19** — frontend and API routes
- **Payload CMS 3** — headless CMS backed by PostgreSQL, served at `/admin`
- **PostgreSQL 16** — primary database (runs in Docker)
- **MinIO** — S3-compatible object storage for media files (runs in Docker)
- **Traefik v3** — reverse proxy / TLS termination (Let's Encrypt)
- **MDX** with custom plugins (rehype-mathjax, dnd-kit, Monaco Editor)

The entire production stack runs via **Docker Compose**. You must never run `npm run dev` or `npm install` directly on the host machine.

---

## 2. Repository Structure

```
/                            ← repo root (you are here)
├── app/                     ← Next.js + Payload CMS application
│   ├── Dockerfile           ← Multi-stage: deps / migrator / dev / builder / runner
│   ├── collections/         ← Payload CMS collection definitions
│   ├── payload.config.ts    ← Payload configuration
│   └── app/                 ← Next.js App Router pages & API
├── docker-compose.yml       ← Local development compose (do NOT use in production)
├── docker-compose.prod.yml  ← Production app services (postgres, minio, migrate, web)
├── docker-compose.traefik.yml ← Traefik reverse proxy (separate project)
├── .env.prod.example        ← Template for production environment variables
├── scripts/
│   ├── deploy.sh            ← First-time full deploy script
│   └── update-app-in-server.sh ← Subsequent app updates (no infra restart)
```

---

## 3. Prerequisites on This Server (Ubuntu 24.04)

Before running the deploy script, verify these are in place:

### 3a. Docker Engine + Docker Compose Plugin
```bash
docker --version          # should exist
docker compose version    # must say "Docker Compose version v2.x"
```
If missing:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # then log out and back in, or use: newgrp docker
```

### 3b. Git and repo
```bash
git remote -v   # should show origin pointing to the GitHub repo
git status      # should be clean on branch 'main'
```

### 3c. `.env.prod` file
```bash
ls -la .env.prod   # must exist and NOT be the example file
```
If it does not exist:
```bash
cp .env.prod.example .env.prod
```
Then fill in every `CHANGE_ME_*` value. Required variables:
- `NEXT_PUBLIC_SERVER_URL` — e.g. `https://kuara.ufsj.edu.br`
- `PAYLOAD_SECRET` — generate: `openssl rand -hex 64`
- `POSTGRES_PASSWORD` — generate: `openssl rand -hex 32`
- `MINIO_ROOT_USER` — e.g. `kuara-admin`
- `MINIO_ROOT_PASSWORD` — generate: `openssl rand -hex 32`
- `TRAEFIK_DOMAIN` — e.g. `kuara.ufsj.edu.br` (no https://)
- `TRAEFIK_ACME_EMAIL` — e.g. `admin@ufsj.edu.br`

### 3d. DNS and firewall
- A DNS A record for `TRAEFIK_DOMAIN` must point to this server's public IP.
- Ports **80** and **443** must be open:
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw status
  ```

---

## 4. First-Time Deployment

Run from the **repo root**:
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script does these steps in order:
1. Pre-flight checks (Docker, `.env.prod`, required vars)
2. Pulls latest code from `origin/main`
3. Starts Traefik (cleans up port conflicts and stale networks if needed)
4. Builds Docker images: `migrate` and `web` (multi-stage, no cache)
5. Starts `postgres` and `minio`, waits for PostgreSQL to be healthy
6. Runs database migrations (`npx payload migrate` via the `migrate` container)
7. Starts all services (`web`, `createbuckets`, etc.)
8. Waits up to 3 minutes for the web health check at `http://localhost:3000/api/health`
9. Prunes dangling images

**Success output:** `Deploy complete! Site is live at: https://<TRAEFIK_DOMAIN>`

---

## 5. Subsequent Updates (After Initial Deploy)

When the app code has changed (e.g. after a `git pull`):
```bash
./scripts/update-app-in-server.sh
```
This rebuilds only `migrate` and `web` images, runs migrations, and restarts the web service. It does NOT touch Traefik, PostgreSQL, or MinIO.

---

## 6. Diagnosing Failures

### View running containers
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.traefik.yml ps
```

### Logs
```bash
# Web app
docker compose -f docker-compose.prod.yml logs --tail=100 -f web

# Database migrations
docker compose -f docker-compose.prod.yml logs --tail=100 migrate

# Traefik
docker compose -f docker-compose.traefik.yml logs --tail=50 traefik

# PostgreSQL
docker compose -f docker-compose.prod.yml logs --tail=50 postgres

# MinIO
docker compose -f docker-compose.prod.yml logs --tail=50 minio
```

### Health check manually
```bash
docker compose -f docker-compose.prod.yml exec -T web wget -qO- http://localhost:3000/api/health
```

### Common failure scenarios

| Symptom | Likely cause | Fix |
|---|---|---|
| `deploy.sh` fails at step "Pre-flight" | Missing or incomplete `.env.prod` | Fill all `CHANGE_ME_*` values |
| Traefik fails to start | Port 80/443 held by another process | Script handles this; if it persists, `sudo lsof -i :80` and kill the process |
| `traefik-net` error | Stale network with wrong label | `docker network rm traefik-net` then re-run deploy |
| Migration container exits non-zero | DB not ready or payload config error | Check `docker logs <migrate-container>` |
| Web health check times out | Build issue or DB connection | `docker compose -f docker-compose.prod.yml logs web` |
| HTTPS cert not issued | DNS not propagated or port 443 blocked | Verify DNS: `dig +short <TRAEFIK_DOMAIN>`; check `ufw status` |
| `docker compose version` not found | Wrong package name | `sudo apt install docker-compose-plugin` (not `docker-compose`) |
| Permission denied on docker socket | User not in docker group | `sudo usermod -aG docker $USER && newgrp docker` |

---

## 7. Strict Rules — DO NOT Violate

- **NEVER** run `npm run dev` on the host machine.
- **NEVER** run `npm install` on the host machine.
- **NEVER** edit `.env.prod` and commit it — it contains secrets and is in `.gitignore`.
- All application code changes must go through the Docker build pipeline.
- Use `docker-compose.prod.yml` for the app stack and `docker-compose.traefik.yml` for the proxy — they are separate projects intentionally.

---

## 8. Git Workflow — Committing Fixes from the Server

If you make any changes to the codebase on this server (e.g. fixing a script, updating a config file), you **must** commit and push them back to GitHub so the repo stays in sync:

```bash
# Stage specific files (never `git add -A` blindly — avoid committing .env.prod)
git add scripts/deploy.sh   # or whatever file(s) you changed

# Commit
git commit -m "fix: <describe what you fixed and why>"

# Push
git push origin main
```

**Important:** Never commit `.env.prod`, `.env`, or any file containing secrets. Verify with `git status` before committing.

After pushing, the remote origin will have your fixes and the next `git pull` from any machine will get them.

---

## 9. Architecture Quick Reference

```
Internet → Traefik (:80/:443) → [traefik-net] → web container (:3000)
                                                       ↓
                                               postgres (:5432) [kuara-net]
                                               minio (:9000)    [kuara-net]
```

- Traefik terminates TLS and proxies `https://TRAEFIK_DOMAIN` → `web:3000`
- `web` is both the Next.js frontend and the Payload CMS admin (`/admin`)
- `migrate` is a one-shot container that runs DB migrations on every deploy
- `createbuckets` is a one-shot container that initializes the MinIO bucket
- All app data persists in Docker named volumes: `kuara-pgdata` and `kuara-minio-data`

---

## 10. After a Successful Deploy

Verify:
1. `https://<TRAEFIK_DOMAIN>` loads the Kuara frontend
2. `https://<TRAEFIK_DOMAIN>/admin` loads the Payload CMS login
3. TLS certificate is valid (check browser padlock — issued by Let's Encrypt)
4. `docker compose -f docker-compose.prod.yml ps` — all services show `healthy` or `Up`
