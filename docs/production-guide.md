# Kuara — Production Operations Guide

This guide covers everything needed to deploy, operate, and evolve the Kuara
platform on the home server. Read it end-to-end before the first deploy, then
use it as a reference for day-to-day operations.

---

## Cheat Sheet

### Development (dev machine, from repo root)

| Task | Command |
|------|---------|
| Start dev stack | `docker compose up -d` |
| Stop dev stack | `docker compose down` |
| Follow web logs | `docker compose logs -f web` |
| Run static checks (TS + lint + tests) | `cd app && npm run typecheck && npm run lint && npm run test` |
| Generate migration after schema change | `./scripts/create-migration.sh` |
| Open admin panel | http://localhost:3000/payload |

### Production (server at `/opt/kuara`)

| Task | Command |
|------|---------|
| Deploy latest code | `./scripts/update-app-in-server.sh` |
| Check service status | `docker compose -f docker-compose.prod.yml ps` |
| Follow web logs | `docker compose -f docker-compose.prod.yml logs -f web` |
| Follow last migration run | `docker compose -f docker-compose.prod.yml logs migrate` |
| Manual DB backup | `./scripts/backup-db.sh` |
| Restart web only | `docker compose -f docker-compose.prod.yml restart web` |
| Open postgres shell | `docker compose -f docker-compose.prod.yml exec postgres psql -U kuara -d kuara` |
| Check migration state | `SELECT id, name, batch FROM payload_migrations ORDER BY id;` (inside psql) |
| Restore from backup | See [Section 7.4](#74-restore-from-backup) |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server Prerequisites](#2-server-prerequisites)
3. [First-Time Deployment](#3-first-time-deployment)
4. [Cloudflare Tunnel Setup](#4-cloudflare-tunnel-setup)
5. [Ongoing Deployments](#5-ongoing-deployments)
6. [Schema Changes (Migrations)](#6-schema-changes-migrations)
7. [Backup and Restore](#7-backup-and-restore)
8. [Monitoring and Logs](#8-monitoring-and-logs)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture Overview

```
Internet
   │
   ▼
Cloudflare Edge  (TLS termination, DDoS, WAF)
   │  cloudflared tunnel
   ▼
Ubuntu Server 24.04  (Tailscale: 100.84.212.53)
   │
   ├── Traefik  :80 / :443  (reverse proxy + Let's Encrypt TLS)
   │      │
   │      ▼
   ├── web  :3000  (Next.js 15 + Payload CMS)
   │
   ├── migrate  (one-shot container — runs DB migrations, exits)
   │
   ├── postgres :5432  (internal network only)
   │
   └── minio  :9000  (S3-compatible media storage, internal only)
```

**Key rules:**
- Traefik handles routing and TLS certificates (Let's Encrypt). Internet traffic
  enters exclusively through the Cloudflare tunnel.
- `migrate` runs before `web` on every deploy and must exit 0 for `web` to start.
- All secrets live in `.env.prod` on the server. This file is never committed.

---

## 2. Server Prerequisites

Run these once on the Ubuntu Server 24.04 machine (as a user with sudo).

### 2.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker          # apply group change without logout
docker --version       # verify
```

### 2.2 Clone the Repository

```bash
sudo mkdir -p /opt/kuara
sudo chown $USER:$USER /opt/kuara
git clone <your-repo-url> /opt/kuara
cd /opt/kuara
```

### 2.3 Create the Production Environment File

```bash
cp .env.prod.example .env.prod
nano .env.prod         # fill in every value (see comments in the file)
```

Generate secure values with:
```bash
openssl rand -base64 32   # use once for POSTGRES_PASSWORD, once for PAYLOAD_SECRET
```

`.env.prod` must contain:
```
POSTGRES_PASSWORD=<strong-random-password>
PAYLOAD_SECRET=<min-32-char-random-secret>
NEXT_PUBLIC_SERVER_URL=https://kuara.filgusto.com
```

### 2.4 Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

---

## 3. First-Time Deployment

This sequence is run **exactly once** on a fresh server. After this, use the
[Ongoing Deployments](#5-ongoing-deployments) section.

### Step 1 — Start PostgreSQL

```bash
docker compose -f docker-compose.prod.yml up -d postgres
```

Wait until healthy:
```bash
docker compose -f docker-compose.prod.yml ps
# postgres should show "(healthy)"
```

### Step 2 — Bootstrap the Migration Baseline

The database schema was previously created by Payload's `push: true` mode.
This script registers the baseline migration as "already applied" so that
`payload migrate` does not try to re-create existing tables.

```bash
./scripts/init-migrations-baseline.sh
```

The script will ask for confirmation before making any changes. It inserts one
row into `payload_migrations` with `batch = 0` (a sentinel value meaning
"bootstrap, not a real migration run").

> **Only run this once.** Running it again after real migrations have been
> applied will corrupt the migration state.

### Step 3 — Full Deploy

```bash
./scripts/deploy.sh
```

This builds all images, runs pending migrations (none on first deploy), starts
all services, waits for the web service health check, and prunes old images.

Expected output ends with:
```
[...] Web service is healthy.
[...] Deploy complete. Running containers:
NAME    IMAGE   ...STATUS
```

### Step 4 — Create the First Admin User

Open `https://kuara.filgusto.com/kuara/payload` in your browser. Payload will prompt
you to create the initial admin account on the first visit.

---

## 4. Cloudflare Tunnel Setup

Do this after the stack is running locally (Step 3 above).

### 4.1 Add Domain to Cloudflare

1. Create a free account at cloudflare.com.
2. Add `filgusto.com` → Cloudflare scans your DNS records automatically.
3. In Squarespace: update nameservers to the two Cloudflare provides.
4. Wait for propagation (usually minutes, up to 48h).

### 4.2 Install and Authenticate cloudflared

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login    # opens a browser — authenticate with your Cloudflare account
```

### 4.3 Create the Tunnel

```bash
cloudflared tunnel create kuara-prod
# Note the tunnel ID printed — you'll need it below
```

### 4.4 Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/<your-user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: kuara.filgusto.com
    service: http://localhost:80
  - service: http_status:404
```

Route the subdomain to the tunnel:

```bash
cloudflared tunnel route dns kuara-prod kuara.filgusto.com
```

### 4.5 Install as a System Service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared    # should show "active (running)"
```

### 4.6 Verify

Open `https://kuara.filgusto.com` in a browser outside your home network
(use mobile data). You should see the Kuara homepage.

### 4.7 Harden the Firewall (UFW)

Allow SSH only from Tailscale, block everything else inbound. Cloudflared
makes outbound connections — no inbound ports needed.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 100.64.0.0/10 to any port 22   # SSH from Tailscale subnet only
sudo ufw enable
sudo ufw status
```

---

## 5. Ongoing Deployments

### 5.1 Pre-Deploy Checklist (run on dev machine before pushing)

**If your commits touched any file under `app/collections/`**, a migration file
must exist in `app/migrations/` before you push. Production never generates
migrations — it only applies files that are baked into the Docker image at build
time. A missing migration means the `migrate` service exits non-zero and the
deploy aborts with the old web container still running.

**Check from your dev machine:**

```bash
# 1. See which collection files changed since the last production deploy
git diff origin/main --name-only | grep app/collections/

# 2. If any collection changed, confirm a matching migration was committed
git log --oneline app/migrations/   # most recent entry should be from this branch
```

If a collection changed but no new migration appears in `app/migrations/`, stop
and generate one before pushing (see [Section 6.2](#62-generating-a-migration-dev-machine)).

> **Why this matters:** Dev uses `push: true` — Payload silently alters the
> local database on startup with no paper trail. Production uses `push: false`
> and relies exclusively on committed migration files. The two environments can
> drift without warning; the checklist above is the only gate.

### 5.2 Deploy

Once the checklist passes, run on the **production server**:

```bash
cd /opt/kuara
./scripts/update-app-in-server.sh
```

> `deploy.sh` is for **first-time server setup only** (Traefik, network bootstrap,
> initial postgres start). For every subsequent code update, use
> `update-app-in-server.sh`.

What the script does, in order:
1. `git pull origin main` — pulls latest code.
2. Builds `migrator` and `web` Docker images (migration files are baked in here).
3. Runs `docker compose run --rm migrate` — applies any pending migrations.
   **If this exits non-zero, the deploy aborts before touching the web service.**
4. `docker compose up -d --no-deps web` — restarts only the web service; postgres, minio, and Traefik are left untouched.
5. Waits up to 3 min for the web health check (`/api/health`) to pass.
6. Prunes dangling Docker images.

To deploy a specific branch:
```bash
./scripts/update-app-in-server.sh --branch feature/some-branch
```

---

## 6. Schema Changes (Migrations)

Whenever you add, rename, or remove a field in a Payload collection, you must
create a migration before deploying.

### 6.1 The Workflow

```
Edit collection file (e.g. app/collections/Courses.ts)
         ↓
Generate migration (on dev machine — see below)
         ↓
Review the generated .ts migration file
         ↓
git commit (collection file + migration files)
         ↓
git push
         ↓
./scripts/update-app-in-server.sh   ← migration runs automatically in production
```

### 6.2 Generating a Migration (Dev Machine)

**Step 1 — Start the dev stack** (if not already running):

```bash
# From repo root
docker compose up -d
```

Wait until the `web` container is healthy before continuing. The migration
script connects into that container and uses the live dev database to compute
the schema diff — it will fail if the container is not running.

**Step 2 — Run the migration script:**

```bash
./scripts/create-migration.sh
```

The script executes entirely inside the running `web` container. It
pre-compiles `payload.config.ts` to a temporary `.mjs` file via esbuild (to
work around a Node 22 / ESM compatibility issue), runs
`npx payload migrate:create`, and then deletes the temporary file. New files
appear in `app/migrations/` on your host machine via the Docker volume mount.

> **Prerequisite:** `docker compose up -d` must be running before calling this
> script. It will error immediately if the `web` container is not up.

### 6.3 What Gets Generated

Three files appear in `app/migrations/`:

| File | Purpose |
|------|---------|
| `<timestamp>_<name>.ts` | The actual migration: `up()` and `down()` functions with SQL |
| `<timestamp>_<name>.json` | Drizzle schema snapshot — used to compute the DIFF for the next migration |
| `index.ts` | Updated automatically — registry of all migrations |

**Commit all three files.** The `.json` snapshot is critical: without it, the
next `migrate:create` will re-generate the full schema instead of just the diff.

> **Do not "clean up" a `.json` with no matching `.ts`.** Payload picks the
> baseline snapshot by filename alone — `readdirSync(dir).filter(.json).sort().reverse()[0]`
> — so the newest `.json` is authoritative whether or not its migration still
> exists. `20260611_164246.json` is exactly this case: its `.ts` was deleted in
> 9c20415 as a duplicate of the hand-written `20260611_000000.ts`, but the
> snapshot is the only one recording the `question_offsets` columns. Deleting it
> would make the next migration diff against the 20260407 snapshot and re-emit
> those columns.

### 6.4 Reviewing the Migration File

Open `app/migrations/<timestamp>_<name>.ts` and verify:
- `up()` contains only the SQL changes you expect (ALTER TABLE, ADD COLUMN, etc.).
- `down()` can safely reverse the change if needed.
- No unexpected DROP TABLE or DROP COLUMN statements (those cause data loss).

If the migration looks wrong, delete all three generated files, fix the
collection, and re-run `migrate:create`.

### 6.5 Dangerous Operations

Some schema changes are inherently destructive:

| Operation | Risk | Safe approach |
|-----------|------|---------------|
| Rename a field | Old column dropped, new column created — data lost | Add new field, backfill data in a separate migration, then drop old field |
| Change field type | Column dropped and recreated | Same: add new column, backfill, drop old |
| Remove a field | Column dropped | Ensure data is no longer needed or backed up |

Always run `./scripts/backup-db.sh` manually before deploying a migration that
modifies or removes existing columns.

---

## 7. Backup and Restore

### 7.1 Automated Nightly Backups

Add the backup script to cron on the server:

```bash
crontab -e
```

Add this line (runs at 02:00 every night):
```
0 2 * * * /opt/kuara/scripts/backup-db.sh >> /var/log/kuara-backup.log 2>&1
```

Backups are stored in `/var/backups/kuara/` (configurable via `BACKUP_DIR`).
Files older than 30 days are deleted automatically (configurable via `KEEP_DAYS`).

### 7.2 Manual Backup

```bash
cd /opt/kuara
./scripts/backup-db.sh
ls -lh /var/backups/kuara/
```

### 7.3 Optional Offsite Backup with rclone

Install rclone and configure a remote (e.g. Backblaze B2, Cloudflare R2):

```bash
sudo apt install rclone
rclone config    # follow the interactive setup for your provider
```

Then set `RCLONE_REMOTE` in the cron entry:
```
0 2 * * * RCLONE_REMOTE="b2:my-bucket/kuara" /opt/kuara/scripts/backup-db.sh >> /var/log/kuara-backup.log 2>&1
```

### 7.4 Restore from Backup

```bash
# List available backups
ls -lh /var/backups/kuara/

# Stop the web service (postgres must keep running)
docker compose -f /opt/kuara/docker-compose.prod.yml stop web

# Restore
gunzip -c /var/backups/kuara/kuara_<timestamp>.sql.gz \
  | docker compose -f /opt/kuara/docker-compose.prod.yml exec -T postgres \
      psql -U kuara -d kuara

# Restart web
docker compose -f /opt/kuara/docker-compose.prod.yml up -d web
```

> After restoring, the migration table reflects the state at backup time. If you
> deployed new migrations after the backup was taken, re-run
> `./scripts/update-app-in-server.sh` to apply them again.

---

## 8. Monitoring and Logs

### 8.1 Check Service Status

```bash
cd /opt/kuara
docker compose -f docker-compose.prod.yml ps
```

### 8.2 Follow Live Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Web only (Next.js + Payload)
docker compose -f docker-compose.prod.yml logs -f web

# Postgres only
docker compose -f docker-compose.prod.yml logs -f postgres

# Last migration run
docker compose -f docker-compose.prod.yml logs migrate
```

### 8.3 Check the Cloudflare Tunnel

```bash
sudo systemctl status cloudflared
journalctl -u cloudflared -f      # live tunnel logs
```

### 8.4 Disk Usage

```bash
# Docker volumes (postgres data + media uploads)
docker system df -v

# Backup directory
du -sh /var/backups/kuara/

# Overall disk
df -h
```

### 8.5 Resource Usage

```bash
docker stats    # live CPU, memory, network per container
```

---

## 9. Troubleshooting

### Web service fails to start after deploy

```bash
docker compose -f docker-compose.prod.yml logs web
```

Common causes:
- Missing environment variable in `.env.prod` → add it and redeploy.
- Port 3000 already in use → check for conflicting processes with `lsof -i :3000`.
- Payload migration failed → check `docker compose logs migrate`.

### Migration exits non-zero and blocks deploy

```bash
docker compose -f docker-compose.prod.yml logs migrate
```

Common causes:
- **"relation already exists"** — a migration was applied manually or via push.
  Check `payload_migrations` table and insert the offending migration manually
  as already applied (batch = current batch number).
- **"column does not exist"** — the down() of a previous migration ran
  incorrectly. Restore from backup, then replay migrations cleanly.
- **Database connection refused** — postgres is not healthy yet. Re-run `./scripts/update-app-in-server.sh`.

Inspect the migration state:
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U kuara -d kuara \
  -c "SELECT id, name, batch, created_at FROM payload_migrations ORDER BY id;"
```

### Cloudflare Tunnel is down

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
journalctl -u cloudflared --since "5 minutes ago"
```

If the tunnel credential file is missing or expired:
```bash
cloudflared tunnel login
sudo systemctl restart cloudflared
```

### Postgres won't start (volume corruption)

```bash
docker compose -f docker-compose.prod.yml logs postgres
```

If data is corrupted, restore from the latest backup:
```bash
docker compose -f docker-compose.prod.yml down
docker volume rm kuara-website_kuara-pgdata
docker compose -f docker-compose.prod.yml up -d postgres
# wait for healthy, then restore from backup (see Section 7.4)
```

### Media uploads are missing after rebuild

Media files are stored in the `kuara-media` Docker named volume mounted at
`/app/public/media` inside the container. As long as `docker compose down` is
used without `-v`, the volume persists. If you accidentally used `-v`:

```bash
# Check if the volume still exists
docker volume ls | grep kuara-media

# If missing, restore from a media backup (set up separately with rclone)
```

To avoid accidental volume deletion, **never use** `docker compose down -v` in
production.

### Running out of disk space

```bash
# Remove unused Docker images, build cache, stopped containers
docker system prune -f

# Remove old backups manually if the cron retention isn't enough
find /var/backups/kuara -name "*.sql.gz" -mtime +7 -delete
```

