import { monitorEventLoopDelay } from "node:perf_hooks";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { withTimeout } from "@/lib/with-timeout";

// Fail fast: a probe that hangs only turns into a timeout in Docker/Traefik
// with no hint of which dependency is stuck.
const CHECK_TIMEOUT_MS = 5000;

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  // Histogram values are nanoseconds; report the worst lag since last probe.
  const eventLoopLagMs = Math.round(loopDelay.max / 1e6);
  loopDelay.reset();

  try {
    await withTimeout(
      (async () => {
        const payload = await getPayload({ config: configPromise });
        await payload.db.pool.query("SELECT 1");
      })(),
      CHECK_TIMEOUT_MS,
      "health check",
    );
    return NextResponse.json({ status: "ok", timestamp, eventLoopLagMs });
  } catch (err) {
    console.error(
      `[health] failing: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { status: "error", timestamp, eventLoopLagMs },
      { status: 503 },
    );
  }
}
