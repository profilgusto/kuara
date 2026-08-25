import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise });
    await payload.db.pool.query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
