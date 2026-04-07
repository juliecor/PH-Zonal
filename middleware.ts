import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

<<<<<<< Updated upstream
  // Allow the welcome page and all API/static routes without redirecting
  if (
    pathname.startsWith("/welcome") ||
=======
  // Define public routes (always accessible, no token required)
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/welcome" ||   // ✅ Add welcome as public
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
>>>>>>> Stashed changes
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/pictures") ||
<<<<<<< Updated upstream
    pathname.startsWith("/fonts")
  ) {
    return NextResponse.next();
  }

  // Always show welcome first unless explicitly skipped with a query param
  const skip = searchParams.get("skip") === "1";
  if (!skip && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
=======
    pathname.startsWith("/fonts");

  // If it's a public route, allow access
  if (isPublicRoute) {
    // But if user is already logged in and tries to visit /login or /register,
    // redirect them to /
    if (token && (pathname === "/login" || pathname === "/register")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // All other routes require authentication
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
>>>>>>> Stashed changes
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};