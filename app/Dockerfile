# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install libc compat for native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ─── Stage: migrator (runs Payload DB migrations in production) ───────────────
# Has full source + node_modules so `npx payload migrate` can run.
# NODE_ENV=production disables push:true, enabling the migration runner.
#
# Why we pre-compile to .mjs:
#   Node.js 22.12+ allows require() of ESM modules synchronously, but throws
#   ERR_REQUIRE_ASYNC_MODULE when the ESM graph cannot be evaluated synchronously.
#   tsx loads payload.config.ts as CJS (no "type":"module" in package.json),
#   converting `import` → `require()`. Those require() calls hit ESM-only
#   @payloadcms/* packages, triggering the synchronous ESM path which fails.
#   Compiling to .mjs first lets Node.js load the config as native ESM via
#   dynamic import(), completely bypassing the CJS/require() path.
FROM node:22-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Pre-compile payload.config.ts → payload.config.mjs (ESM, external packages)
# Collections are bundled inline; @payloadcms/* and other node_modules stay as
# ESM import declarations so Node.js loads them natively without require().
RUN node_modules/.bin/esbuild payload.config.ts \
      --bundle \
      --packages=external \
      --format=esm \
      --platform=node \
      --outfile=payload.config.mjs

# Tell Payload CLI to load the pre-compiled ESM config instead of the .ts file
ENV PAYLOAD_CONFIG_PATH=./payload.config.mjs

CMD ["npx", "payload", "migrate"]

# ─── Stage: dev (used by docker-compose for local development) ────────────────
# Runs `next dev`. Payload uses push:true in dev (NODE_ENV != production).
FROM node:22-alpine AS dev
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ─── Stage 2: builder (for production builds) ─────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the PDF.js worker is in public/ (in case it wasn't committed)
RUN cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs

# Enable standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: runner (production) ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what Next.js standalone output needs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
