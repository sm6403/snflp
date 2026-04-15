import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import AdminLeaguesContent from "@/components/admin-leagues-content";

export const dynamic = "force-dynamic";

export default async function AdminLeaguesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }

  return <AdminLeaguesContent />;
}
