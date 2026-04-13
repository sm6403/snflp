import { verifyAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { SeasonManagerContent } from "@/components/season-manager-content";

export default async function SeasonsPage() {
  const ok = await verifyAdminSession();
  if (!ok) redirect("/admindash/login");
  return <SeasonManagerContent />;
}
