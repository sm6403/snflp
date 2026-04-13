import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearAdminSessionCookie());
  return response;
}
