# Kuara — Production Operations Guide

This guide covers everything needed to deploy, operate, and evolve the Kuara
platform on the home server. Read it end-to-end before the first deploy, then
use it as a reference for day-to-day operations.

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
   ├── Nginx  :80  (127.0.0.1 only — internal reverse proxy)
   │      │
   │      ▼
   ├── web  :3000  (Next.js 15 + Payload CMS)
   │
   ├── migrate  (one-shot container — runs DB migrations, exits)
   │
   └── postgres :5432  (internal network only)
```

**Key rules:**
- Port 80 is bound to `127.0.0.1` only. The internet enters exclusively through
  the Cloudflare tunnel. No port is publicly exposed on the host.
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

Open `https://kuara.filgusto.com/admin` in your browser. Payload will prompt
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

After the first deploy, every code update follows this single command:

```bash
cd /opt/kuara
./scripts/deploy.sh
```

What the script does, in order:
1. `git pull origin main` — pulls latest code.
2. Builds `migrator` and `web` Docker images.
3. Starts postgres (if not already running).
4. Runs `docker compose run --rm migrate` — applies any pending migrations.
   **If this exits non-zero, the deploy aborts before touching the web service.**
5. `docker compose up -d --remove-orphans` — starts/updates all services.
6. Waits up to 120s for the web health check to pass.
7. Prunes dangling Docker images.

To deploy a specific branch:
```bash
./scripts/deploy.sh --branch feature/some-branch
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
./scripts/deploy.sh   ← migration runs automatically in production
```

### 6.2 Generating a Migration (Dev Machine)

Due to a compatibility issue between tsx 4.x and Node 22 in projects without
`"type": "module"`, the Payload CLI requires a temporary workaround to load
`payload.config.ts` as an ES module.

Run this inside the running dev container:

```bash
# From repo root on your dev machine
docker compose exec web sh -c '
  # 1. Temporarily enable ESM mode
  node -e "
    const fs = require(\"fs\");
    const p = JSON.parse(fs.readFileSync(\"./package.json\", \"utf8\"));
    p.type = \"module\";
    fs.writeFileSync(\"./package.json\", JSON.stringify(p, null, 2));
  "

  # 2. Generate the migration
  npx payload migrate:create --name describe_your_change

  # 3. Immediately revert — DO NOT skip this step
  node -e "
    const fs = require(\"fs\");
    const p = JSON.parse(fs.readFileSync(\"./package.json\", \"utf8\"));
    delete p.type;
    fs.writeFileSync(\"./package.json\", JSON.stringify(p, null, 2));
  "
'
```

Replace `describe_your_change` with a short snake_case description, e.g.
`add_course_thumbnail` or `rename_module_title_to_name`.

> **Why the workaround?** tsx 4.x ESM worker threads don't resolve extensionless
> TypeScript imports when the package has no `"type": "module"`. Temporarily
> adding it makes tsx treat `payload.config.ts` as ESM, which is the correct
> loading path for the Payload CLI. The dev server is unaffected because the
> revert happens in the same command.

### 6.3 What Gets Generated

Three files appear in `app/migrations/`:

| File | Purpose |
|------|---------|
| `<timestamp>_<name>.ts` | The actual migration: `up()` and `down()` functions with SQL |
| `<timestamp>_<name>.json` | Drizzle schema snapshot — used to compute the DIFF for the next migration |
| `index.ts` | Updated automatically — registry of all migrations |

**Commit all three files.** The `.json` snapshot is critical: without it, the
next `migrate:create` will re-generate the full schema instead of just the diff.

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
> deployed new migrations after the backup was taken, re-run `deploy.sh` to
> apply them again.

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
- **Database connection refused** — postgres is not healthy yet. Re-run `deploy.sh`.

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

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Deploy latest code | `./scripts/deploy.sh` |
| Follow web logs | `docker compose -f docker-compose.prod.yml logs -f web` |
| Manual DB backup | `./scripts/backup-db.sh` |
| Check service status | `docker compose -f docker-compose.prod.yml ps` |
| Restart web only | `docker compose -f docker-compose.prod.yml restart web` |
| Open postgres shell | `docker compose -f docker-compose.prod.yml exec postgres psql -U kuara -d kuara` |
| Check migration state | `SELECT * FROM payload_migrations ORDER BY id;` (inside psql) |
| Generate migration | See [Section 6.2](#62-generating-a-migration-dev-machine) |
| Restore from backup | See [Section 7.4](#74-restore-from-backup) |
