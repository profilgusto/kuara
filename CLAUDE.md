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
- `npm run test` (Vitest component logic checking)
- `npm run format` (Prettier auto-formatting)

**Phase 2: Full Integration Testing** 
Only after Phase 1 passes, run from root (`/`):
- `docker-compose up --build -d`
- Web app is at `http://localhost:3000` | Payload Admin is at `http://localhost:3000/admin`.
- `docker-compose logs -f web` to monitor output.
- *Strict Rule:* NUNCA rode `npm run dev` na máquina host. Use apenas o Docker Compose.

## 2. Project Gotchas & Architecture Rules
- **Progressive Discovery:** Do not reinvent the wheel. Check existing KIs (Knowledge Items), `/components`, and `/collections` before proposing new ones.
- **Database & CMS:** Any new data requirement MUST go through a Payload CMS Collection. Define it in `app/collections/`, then ensure `app/payload.config.ts` exports it.
- **Styling:** We use Tailwind CSS via Shadcn UI patterns. Do not use plain CSS or styled-components.
- **File Structure:**
  - `app/admin/`: Payload CMS admin panel files.
  - `app/app/`: Next.js frontend pages and API.
  - `app/mdx-plugins/`: Custom rehype/remark plugins.

## 3. Verification Protocol (MANDATORY)
Execute this silently before returning control:
1. Re-read the full original task specification.
2. For each stated requirement: test it programmatically (Phase 1) or visually (Phase 2), confirm it works, and state the evidence.
3. Apply implicit quality bars (error handling, type safety, responsive formatting).
4. If something fails: fix and re-verify from scratch. Do not patch and assume.
5. After 3 full fix-verify cycles with a persistent failure, STOP and report the blocker. Do not return broken work.
6. Only return control when every requirement has verified evidence of passing.
