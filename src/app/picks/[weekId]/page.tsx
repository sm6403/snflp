import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WeeklyPicks } from "@/components/weekly-picks";

interface Props {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ userId?: string }>;
}

export default async function WeekPicksPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const { weekId } = await params;
  const { userId } = await searchParams;
  return <WeeklyPicks weekId={weekId} userId={userId} />;
}
