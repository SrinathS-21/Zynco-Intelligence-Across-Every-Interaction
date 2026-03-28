import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ParityDashboardShell from "@/components/ParityDashboardShell";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ParityDashboardShell userId={user.id} />;
}
