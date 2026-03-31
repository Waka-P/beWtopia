import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number.parseInt(session.user.id, 10);

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
  } | null;

  if (!body || typeof body !== "object" || typeof body.name !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rawName = body.name.trim();
  if (!rawName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (rawName.length > 10) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  const existingJob = await prisma.job.findUnique({
    where: { name: rawName },
  });

  let job = existingJob;

  if (!job) {
    job = await prisma.job.create({
      data: { name: normalizeUserInput(rawName) },
    });
  }

  await prisma.userJob.upsert({
    where: {
      userId_jobId: {
        userId,
        jobId: job.id,
      },
    },
    update: {},
    create: {
      userId,
      jobId: job.id,
    },
  });

  return NextResponse.json({ job });
}
