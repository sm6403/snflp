import { prisma } from "@/lib/prisma";

/**
 * Write an entry to the admin audit log.
 * Fire-and-forget — never throws so it never blocks or breaks a route.
 */
export async function logAdminAction(
  adminName: string,
  action: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminName,
        action,
        detail: JSON.stringify(detail),
      },
    });
  } catch (err) {
    // Log to server console but don't surface to client
    console.error("[admin-log] Failed to write audit log entry:", err);
  }
}
