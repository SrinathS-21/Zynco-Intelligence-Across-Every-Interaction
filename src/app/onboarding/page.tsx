import OnboardingView from "@/features/onboarding/OnboardingView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zynco | Connection Hub",
  description: "Unified communication. Connect your world and see every message in a premium, cross-pollinated dashboard.",
};

export default function Page() {
  return <OnboardingView />;
}
