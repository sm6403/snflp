import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/user/email
// Body: { email: string }
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Check if already taken by another user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email },
  });

  return NextResponse.json({ success: true });
}
