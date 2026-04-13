import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_session";

function getSecret() {
  return process.env.AUTH_SECRET!;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createAdminSessionCookie(): string {
  const token = "admin:authenticated";
  const signature = sign(token);
  const cookieValue = `${token}.${signature}`;
  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const lastDot = cookie.value.lastIndexOf(".");
  if (lastDot === -1) return false;

  const token = cookie.value.slice(0, lastDot);
  const signature = cookie.value.slice(lastDot + 1);

  const expected = sign(token);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
