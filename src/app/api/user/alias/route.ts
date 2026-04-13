import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alias } = await request.json();

  if (typeof alias !== "string") {
    return NextResponse.json({ error: "Invalid alias" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { alias: alias || null },
  });

  return NextResponse.json({ alias });
}
