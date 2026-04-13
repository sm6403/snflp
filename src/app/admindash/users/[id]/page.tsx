import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminManageUser } from "@/components/admin-manage-user";

export const dynamic = "force-dynamic";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }

  const { id } = await params;

  return <AdminManageUser userId={id} />;
}
