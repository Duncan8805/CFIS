import { NextResponse, type NextRequest } from "next/server";

// 沒有 session cookie 的請求先導去登入頁。
// 這裡只檢查 cookie 是否存在；session 是否有效由 (app)/layout.tsx 查資料庫確認。
const PUBLIC_PATHS = ["/login", "/offline", "/api/health", "/manifest.webmanifest", "/sw.js"];
const PUBLIC_PREFIXES = ["/icons/", "/_next/", "/assets/"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (request.cookies.has("cfis_session")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|favicon).*)"],
};
