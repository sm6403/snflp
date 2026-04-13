import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WeeklyPicks } from "@/components/weekly-picks";

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  return <WeeklyPicks />;
}
