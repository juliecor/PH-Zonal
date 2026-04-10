import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("authToken")?.value;

  // Always allow auth pages and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/pictures") ||
    pathname.startsWith("/fonts")
  ) {
    // If user is already logged in and hits /login or /register, send to /welcome
    // if (token && (pathname === "/login" || pathname === "/register")) {
    //   const url = req.nextUrl.clone();
    //   url.pathname = "/welcome";
    //   return NextResponse.redirect(url);
    // }
    return NextResponse.next();
  }

  // Redirect unauthenticated homepage to public welcome; protect app routes otherwise
  // if (!token && pathname === "/") {
  //   const url = req.nextUrl.clone();
  //   url.pathname = "/welcome";
  //   return NextResponse.redirect(url);
  // }

  // For other non-static routes (app) require authentication, excluding public welcome
  // if (!token && !pathname.includes(".") && pathname !== "/welcome") {
  //   const url = req.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};