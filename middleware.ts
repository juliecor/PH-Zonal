import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Allow the welcome page and all API/static routes without redirecting
  if (
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/pictures") ||
    pathname.startsWith("/fonts")
  ) {
    return NextResponse.next();
  }

  // Always show welcome first unless explicitly skipped with a query param
  const skip = searchParams.get("skip") === "1";
  if (!skip && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
