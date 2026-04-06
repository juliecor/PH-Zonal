import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("authToken")?.value;

  // Always allow auth pages and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/pictures") ||
    pathname.startsWith("/fonts")
  ) {
    // If user is already logged in and hits /login or /register, send to /welcome
    if (token && (pathname === "/login" || pathname === "/register")) {
      const url = req.nextUrl.clone();
      url.pathname = "/welcome";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Redirect homepage and any other app routes to login when not authenticated
  // if (!token && (pathname === "/" || !pathname.includes("."))) {
  //   const url = req.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
