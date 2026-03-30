import UnifiedDashboardView from "@/features/unified-dashboard/UnifiedDashboardView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zynco | Unified Dashboard",
  description: "Your multi-processed communication hub. Instagram, WhatsApp, LinkedIn, and more in a single feed.",
};

export default function Page() {
  return <UnifiedDashboardView />;
}
