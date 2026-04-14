import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { emailReminders } = body;

  if (typeof emailReminders !== "boolean") {
    return NextResponse.json({ error: "emailReminders must be a boolean" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailReminders },
  });

  return NextResponse.json({ emailReminders });
}
