import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminActivityContent } from "@/components/admin-activity-content";

export default async function ActivityPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }
  return <AdminActivityContent />;
}
