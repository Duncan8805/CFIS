import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getPeriodContext, periodLabel } from "@/lib/data/period";

// 這個群組裡的頁面都要登入
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { periods, current, latest } = await getPeriodContext();
  return (
    <AppShell
      user={{ displayName: user.displayName, role: user.role }}
      periods={{
        options: periods.map((p) => ({ id: p.id, label: periodLabel(p) })),
        currentId: current.id,
        latestId: latest.id,
      }}
    >
      {children}
    </AppShell>
  );
}
