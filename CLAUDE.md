# Kuara Website Project Instructions

This document contains the primary technical guidelines and best practices for developing the Kuara platform. The platform is a unified educational system leveraging modern Web technologies.

## What (Stack and Structure)
- **Frontend / Core App:** Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn UI.
- **CMS / Backend:** Payload CMS 3 integrated natively into the Next.js app (`@payloadcms/next`), backed by PostgreSQL (`@payloadcms/db-postgres`).
- **Content Engine:** MDX-based system for rendering rich content and presentations (slides), featuring `rehype-mathjax`, Drag-and-Drop (`dnd-kit`), Monaco Editor (`@monaco-editor/react`), and custom components (e.g., `KImage`).

## Why (Project Purpose)
- **Primary Goal:** Kuara is an educational content platform and CMS designed to serve rich, interactive modules, presentations, and courses. 
- It empowers creators to build dynamic learning experiences through customizable MDX content and an elegant, performant UI.

## How (Running, Testing, and Conventions)

### 1. Environment & Setup

When developing, follow a **Two-Phase Verification** approach to ensure code quality before spinning up the heavy Docker environment.

#### Phase 1: Static Validation (Local)
Before running the app or declaring a task complete, you must verify the code is syntactically correct and properly formatted using the local `npm` scripts in the `app/` directory:
- **`npm run typecheck`**: Ensures no TypeScript compilation errors.
- **`npm run lint`**: Ensures no React hook or Next.js linting errors.
- **`npm run test`**: Runs Vitest to ensure local component logic passes.
- **`npm run format`**: Automatically formats the code using Prettier.

#### Phase 2: Integration Testing (Docker)
Once Phase 1 passes cleanly, test the full application (Frontend + CMS + Database):
- **Running the App:** The entire application is orchestrated via Docker Compose.
- **Starting the environment:** Run from the root directory:
  ```bash
  docker-compose up --build -d
  ```
- **Accessing the App:** The web application runs on `http://localhost:3000` and the Payload admin panel at `http://localhost:3000/admin`.
- **Viewing Logs:** Use `docker-compose logs -f web` to monitor the Next.js/Payload output. **Never start `npm run dev` directly on the host machine.** If you need to stop the environment, run `docker-compose down`.
### 2. File Organization
- `app/admin/`: Payload CMS admin panel files.
- `app/app/`: Next.js frontend pages and API configurations (App Router).
- `app/collections/`: Payload CMS schema definitions.
- `app/components/`: Reusable React components (often Shadcn UI).
- `app/mdx-plugins/`: Custom rehype/remark plugins for processing Markdown.
- `app/payload.config.ts`: The central configuration file for Payload CMS.

### 3. Agent Best Practices (For Claude/AI Assistants)

When working on this repository, act as an expert Senior Full-Stack Next.js Developer.

1. **Understand KIs (Knowledge Items):** Always check existing KIs and previous conversation history before starting new component implementations or schema designs. Do not reinvent established patterns.
2. **Component Mindset:** Prefer modular, reusable React components in `app/components/`. If using Shadcn UI, rely on the established Tailwind syntax.
3. **Database & CMS Changes:** Any new data requirement requires a Payload CMS Collection. Define it in `app/collections/`, then ensure `app/payload.config.ts` exports it. 
4. **Testing UI:** Assume you should incrementally build and verify visually. For complex frontend components (like drag-and-drop or Monaco Editor integrations), check the browser developer console directly for React warnings.
5. **Plan Before Execution:** Always use task boundaries and artifacts to plan complex workflows. Break down large requests into smaller chunks. Use `task.md` checklists to track your progress meticulously.
6. **Ask for Clarification:** If a task is ambiguous, requirements are missing, or user intent is unclear, use the `notify_user` tool early rather than making irreversible assumptions. Focus on specific decisions that require their expertise.

### 4. Verification Protocol
Execute this protocol before declaring a task complete or returning control:

- Re-read the full original task specification.
- For each stated requirement: test it, confirm it works, and state the evidence. Do not self-report "done" without executing the actual check.
- For each implicit quality bar (error handling, edge cases, formatting): apply the same standard.
- If something fails: fix and re-verify from scratch. Do not patch and assume.
- After 3 full fix-verify cycles with a persistent failure, stop and report the specific blocker with your diagnosis. Do not return broken work and do not loop silently.
- Only return control when every requirement has verified evidence of passing, or you've explicitly flagged what you couldn't solve and why.
