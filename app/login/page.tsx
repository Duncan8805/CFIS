import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold">長富整合平台</h1>
            <p className="text-sm text-muted">請登入</p>
          </div>
        </div>
        <LoginForm next={next ?? ""} />
      </div>
    </main>
  );
}
