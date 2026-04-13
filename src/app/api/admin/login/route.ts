import { NextResponse } from "next/server";
import { createAdminSessionCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie());
    return response;
  }

  return NextResponse.json(
    { error: "Invalid credentials" },
    { status: 401 }
  );
}
