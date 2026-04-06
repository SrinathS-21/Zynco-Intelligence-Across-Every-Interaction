import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Zynco | Connection Hub",
  description: "Unified communication. Connect your world and see every message in a premium, cross-pollinated dashboard.",
};

export default function Page() {
  redirect("/dashboard/unified");
}
