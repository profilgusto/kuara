# Kuara Platform Instructions

You are acting as a Senior Full-Stack Next.js Developer for the Kuara educational platform. 
**Core Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn UI, Payload CMS 3 (PostgreSQL), and MDX (`rehype-mathjax`, `dnd-kit`, Monaco Editor).

**Why (Project Purpose):** Kuara is an educational content platform and CMS designed to serve rich, interactive modules, presentations, and courses through customizable MDX content and an elegant UI.

## 1. Local Development & Testing Workflow
We strictly follow a **Two-Phase Verification Protocol** to save time and reduce Docker overhead.

**Phase 1: Local Static Validation**
Run from `app/` before declaring a task complete or starting Docker:
- `npm run typecheck` (Validates TS strictness)
- `npm run lint` (Next.js/React rules check)
- `npm run test` (Vitest — see §1.1; must be green, not merely runnable)
- `npm run format` (Prettier auto-formatting)

**Phase 2: Full Integration Testing** 
Only after Phase 1 passes, run from root (`/`):
- `docker-compose up --build -d`
- Web app is at `http://localhost:3000` | Payload Admin is at `http://localhost:3000/payload`.
- `docker-compose logs -f web` to monitor output.
- *Strict Rule:* NUNCA rode `npm run dev` na máquina host. Use apenas o Docker Compose.
- *After adding an npm dependency:* `docker compose up -d --build --renew-anon-volumes web`.
  `/app/node_modules` is an anonymous volume that survives a plain `--build`, so a
  new package is in the image but not in the running container — the app fails with
  `Module not found` for something that is clearly in `package.json`.

### 1.1 The Test Suite

Tests run under Vitest (jsdom + Testing Library) and live **next to the code
they cover**: `lib/slides.ts` → `lib/slides.test.ts`. There is no separate
`__tests__/` tree.

| Command | Use |
|---------|-----|
| `npm run test` | One-shot run — part of Phase 1 |
| `npm run test:watch` | Re-runs on save while developing |
| `npm run test -- lib/slides.test.ts` | Single file |

**What belongs in a unit test.** The suite targets pure, deterministic logic —
the MDX extractors (`extractCiteLabels`, `extractHeadings`, the
cross-reference scanners), the basePath helpers, the open-redirect guard, and
presentational components with no data fetching. Anything needing Postgres,
MinIO, or a live Payload instance is Phase 2 territory; do not mock a database
to force it into Phase 1.

**When you add code, add tests.** Any new exported pure function, or a bug fix
in one, ships with cases covering the edge inputs — not just the happy path.
Content-facing extractors run against author-written MDX, so cover the
malformed and quote-style variants too.

**Testing server-only modules.** `vitest.config.ts` aliases `@payload-config`
to the real config and stubs Next.js's `server-only` marker
(`test/stubs/server-only.ts`). Without those, any module in the Payload import
graph fails to resolve at import-analysis time. Extract genuinely pure helpers
into `lib/` rather than reaching into a module that drags in Payload.

**A passing test proves nothing until you have seen it fail.** After writing
one, break the function it covers and confirm the test catches it. Tests that
pass against a deliberately broken implementation are worse than no tests.

## 2. Schema Changes & Migrations (MANDATORY)

Whenever you modify a Payload CMS Collection (add/remove/rename fields, change types), you **must** create a migration file before committing:

```bash
# From the repo root (requires the web container to be running):
./scripts/create-migration.sh
```

This generates a timestamped file in `app/migrations/`. Commit it alongside your collection change.

**Why not `npx payload migrate:create` directly?** Node.js 22.12+ throws `ERR_REQUIRE_ASYNC_MODULE` when the payload CLI tries to `require()` the config, because `@lexical/*` packages use ESM top-level await. The script works around this by pre-compiling `payload.config.ts` → `payload.config.mjs` via esbuild first, so Node loads it as native ESM.

**Why this matters:** Dev uses `push:true` (auto-syncs schema), but prod uses explicit migrations. If no migration file exists, the prod deploy will fail at the `migrate` service. The file is the bridge between dev convenience and prod correctness.

## 3. Project Gotchas & Architecture Rules (read before writing code)
- **Progressive Discovery:** Do not reinvent the wheel. Check existing KIs (Knowledge Items), `/components`, and `/collections` before proposing new ones.
- **Database & CMS:** Any new data requirement MUST go through a Payload CMS Collection. Define it in `app/collections/`, then ensure `app/payload.config.ts` exports it.
- **Styling:** We use Tailwind CSS via Shadcn UI patterns. Do not use plain CSS or styled-components.
- **File Structure:**
  - `app/admin/`: Payload CMS admin panel files.
  - `app/app/`: Next.js frontend pages and API.
  - `app/mdx-plugins/`: Custom rehype/remark plugins.

## 4. Production Deploy Routine

Deploy from the server, never from the dev machine:

```bash
ssh -p 22691 filgusto@kuara.ufsj.edu.br
cd ~/kuara-house/kuara && ./scripts/update-app-in-server.sh
```

The repo lives at `~/kuara-house/kuara` — not `/opt/kuara`. Production is served
under the `/kuara` basePath, so every health probe is `/kuara/api/health`; the
bare `/api/health` returns 404 and will make a healthy deploy look broken.

**Before deploying:** run Phase 1 (§1), then take a database backup —
`BACKUP_DIR=$HOME/kuara-backups ./scripts/backup-db.sh`. If any file under
`app/collections/` changed, confirm a matching migration was committed (§2);
production runs `push:false` and only applies committed files.

**Disk cleanup is part of the deploy, not a separate chore.** Step 7 of the
script prunes dangling images and the build cache on every run. The cache is
what actually fills the disk: it reached 51GB and took the root filesystem to
85% before anyone looked. Never widen these to `-a`, and never reach for
`docker system prune -a`:

- The host is **shared** with other stacks — `fac-*`, `planos-de-ensino-*`,
  `nodered`, `mongo`, `traefik`. `-a` deletes every image no container
  currently references, which takes their images down too.
- `-a` would also delete `kuara-web:rollback`, the tag Step 3 puts on the
  outgoing image so a bad deploy can be reverted without a rebuild:
  `docker tag kuara-web:rollback kuara-web:latest && docker compose -f docker-compose.prod.yml up -d --no-deps web`

**Never let the deploy script update itself mid-run.** It re-execs from a
snapshot outside the repo before `git pull` for this reason. `bash` tracks its
position in a script by byte offset and re-reads from that offset after the file
changes on disk, so a pull that touches the running script makes it resume
inside an unrelated line of the new file — silently, still exiting 0. Two
deploys failed this way, both appearing to blame whatever step sat at the
offset. Preserve the guard when editing the script.

**After deploying, verify from outside:** `https://kuara.ufsj.edu.br/kuara`,
`/kuara/payload` and `/kuara/api/health` must all return 200. A green script is
not evidence on its own.

## 5. Verification Protocol (MANDATORY)
Execute this silently before returning control:
1. Re-read the full original task specification.
2. For each stated requirement: test it programmatically (Phase 1) or visually (Phase 2), confirm it works, and state the evidence.
3. Apply implicit quality bars (error handling, type safety, responsive formatting).
4. If something fails: fix and re-verify from scratch. Do not patch and assume.
5. After 3 full fix-verify cycles with a persistent failure, STOP and report the blocker. Do not return broken work.
6. Only return control when every requirement has verified evidence of passing.
