import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

// 這個群組裡的頁面都要登入
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell userName={user.displayName}>{children}</AppShell>;
}
