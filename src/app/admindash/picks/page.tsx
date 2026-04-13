import { Suspense } from "react";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminPicksContent } from "@/components/admin-picks-content";

export const dynamic = "force-dynamic";

export default async function AdminPicksPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }
  return (
    <Suspense>
      <AdminPicksContent />
    </Suspense>
  );
}
