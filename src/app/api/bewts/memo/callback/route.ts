import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function tryParseBase64Candidate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    // quick filter: must be reasonably long
    if (v.length < 16) return null;
    try {
      const buf = Buffer.from(v, "base64");
      if (buf.length > 0) return v;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // debug log incoming request
  try {
    const text = await req.text();
    // reparse because we consumed the stream
    try {
      req = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: text,
      });
    } catch {}
  } catch {}

  // optional secret check
  const secret = process.env.YWS_CALLBACK_SECRET;
  if (secret) {
    const header =
      req.headers.get("x-callback-secret") || req.headers.get("x-yws-secret");
    if (!header || header !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Determine document name / room id
  const docNames = [
    "docName",
    "documentName",
    "name",
    "room",
    "roomName",
    "roomId",
    "doc",
  ];
  let docName: string | undefined;
  for (const k of docNames) {
    if (typeof body[k] === "string") {
      docName = body[k];
      break;
    }
    if (typeof body[k] === "number") {
      docName = String(body[k]);
      break;
    }
  }

  // If not found, some callbacks send { name: <string>, objects: { prosemirror: <base64> } }
  if (!docName && typeof body.name === "string") docName = body.name;

  // Try to extract a base64 payload from common fields
  let base64: string | null = null;

  // direct fields
  if (!base64 && body.update && typeof body.update === "string")
    base64 = tryParseBase64Candidate(body.update);
  if (!base64 && body.yjsBase64 && typeof body.yjsBase64 === "string")
    base64 = tryParseBase64Candidate(body.yjsBase64);
  if (!base64 && body.updateBase64 && typeof body.updateBase64 === "string")
    base64 = tryParseBase64Candidate(body.updateBase64);

  // objects map
  if (!base64 && body.objects && typeof body.objects === "object") {
    // prefer prosemirror key
    const keys = ["prosemirror", "proseMirror", "xmlFragment"];
    for (const k of keys) {
      if (body.objects[k] && typeof body.objects[k] === "string") {
        base64 = tryParseBase64Candidate(body.objects[k]);
        if (base64) break;
      }
    }
    if (!base64) {
      // fallback: pick first string-valued field
      for (const k of Object.keys(body.objects)) {
        const v = body.objects[k];
        const cand = tryParseBase64Candidate(v);
        if (cand) {
          base64 = cand;
          break;
        }
      }
    }
  }

  // fallback: scan top-level fields
  if (!base64) {
    for (const k of Object.keys(body)) {
      const cand = tryParseBase64Candidate(body[k]);
      if (cand) {
        base64 = cand;
        break;
      }
    }
  }

  if (!base64)
    return NextResponse.json({ error: "no_update_found" }, { status: 400 });

  // derive roomId from docName if prefixed
  let roomId: number | null = null;
  if (docName) {
    // expected pattern used by clients: `bewts-memo-<roomId>`
    const m = docName.match(/bewts-memo-(\d+)/);
    if (m) roomId = Number(m[1]);
    else if (/^\d+$/.test(docName)) roomId = Number(docName);
  }

  if (!roomId)
    return NextResponse.json({ error: "no_room_id" }, { status: 400 });

  const data = Buffer.from(base64, "base64");

  try {
    await prisma.bewtsMemo.upsert({
      where: { roomId },
      create: { roomId, yjsDoc: data },
      update: { yjsDoc: data },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "db_error", detail: String(e) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
