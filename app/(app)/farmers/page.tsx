import type { Metadata } from "next";
import { listFarmersWithPeriod } from "@/lib/data/farmers";
import { getCurrentPeriod, getLatestPeriod, periodLabel } from "@/lib/data/period";
import { FarmersClient } from "./farmers-client";

export const metadata: Metadata = { title: "農民名冊" };

export default async function FarmersPage() {
  const [period, latest] = await Promise.all([getCurrentPeriod(), getLatestPeriod()]);
  const farmers = await listFarmersWithPeriod(period.id);
  return <FarmersClient farmers={farmers} periodLabel={periodLabel(period)} latestLabel={periodLabel(latest)} />;
}
