import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminDashboardContent } from "@/components/admin-dashboard-content";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }

  return <AdminDashboardContent />;
}
