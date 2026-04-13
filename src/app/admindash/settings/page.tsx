import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminSettingsContent } from "@/components/admin-settings-content";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }
  return <AdminSettingsContent />;
}
