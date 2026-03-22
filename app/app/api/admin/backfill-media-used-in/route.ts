import { getPayload } from "payload";
import configPromise from "@payload-config";
import { NextRequest, NextResponse } from "next/server";

function extractMDXFilenames(content: string | null | undefined): Set<string> {
  if (!content) return new Set();
  const regex = /\/media\/([^"'\n\r>)#?]+)/g;
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    names.add(match[1].trim());
  }
  return names;
}

function extractLexicalMediaIds(lexicalData: unknown): Set<number | string> {
  const ids = new Set<number | string>();
  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "upload" && n.relationTo === "media") {
      const value = n.value;
      if (typeof value === "string" || typeof value === "number")
        ids.add(value);
      else if (value && typeof value === "object" && "id" in (value as object))
        ids.add((value as { id: number | string }).id);
    }
    for (const key of ["children", "nodes"] as const) {
      if (Array.isArray(n[key]))
        for (const child of n[key] as unknown[]) traverse(child);
    }
    if ((n as Record<string, unknown>).root)
      traverse((n as Record<string, unknown>).root);
  }
  traverse(lexicalData);
  return ids;
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise });

  const { user } = await payload.auth({ headers: request.headers });
  if (!user || (user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build a map: mediaId -> refs[]
  const usedInMap = new Map<
    number,
    Array<{ relationTo: "modules" | "posts"; value: number }>
  >();

  const allMedia = await payload.find({
    collection: "media",
    limit: 10000,
    depth: 0,
    overrideAccess: true,
  });
  for (const m of allMedia.docs) {
    usedInMap.set(m.id, []);
  }

  // Build an in-memory filename → media doc map to avoid N+1 queries
  const filenameToMedia = new Map<string, (typeof allMedia.docs)[0]>();
  for (const m of allMedia.docs) {
    if (m.filename) {
      filenameToMedia.set(m.filename, m);
    }
  }

  // --- Scan modules (latest draft or published) ---
  const allModules = await payload.find({
    collection: "modules",
    limit: 10000,
    depth: 0,
    draft: true,
    overrideAccess: true,
  });
  for (const mod of allModules.docs) {
    const filenames = extractMDXFilenames(mod.content as string | undefined);
    for (const filename of filenames) {
      // In-memory lookup — no extra DB query per filename
      const media = filenameToMedia.get(filename);
      if (!media) continue;
      const refs = usedInMap.get(media.id) ?? [];
      if (!refs.some((r) => r.relationTo === "modules" && r.value === mod.id)) {
        refs.push({ relationTo: "modules", value: mod.id });
        usedInMap.set(media.id, refs);
      }
    }
  }

  // --- Scan posts (Lexical body) ---
  const allPosts = await payload.find({
    collection: "posts",
    limit: 10000,
    depth: 0,
    draft: true,
    overrideAccess: true,
  });
  for (const post of allPosts.docs) {
    const ids = extractLexicalMediaIds(post.body);
    for (const mediaId of ids) {
      const numId = Number(mediaId);
      if (!usedInMap.has(numId)) continue;
      const refs = usedInMap.get(numId)!;
      if (!refs.some((r) => r.relationTo === "posts" && r.value === post.id)) {
        refs.push({ relationTo: "posts", value: post.id });
      }
    }
  }

  // --- Update all media ---
  let updated = 0;
  for (const [mediaId, refs] of usedInMap) {
    await payload.update({
      collection: "media",
      id: mediaId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { usedIn: refs } as any,
      overrideAccess: true,
    });
    updated++;
  }

  return NextResponse.json({
    success: true,
    updated,
    total: allMedia.docs.length,
  });
}
