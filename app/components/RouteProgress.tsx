"use client";

import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

NProgress.configure({ showSpinner: false, trickleSpeed: 120, minimum: 0.08 });

export default function RouteProgress() {
  const pathname = usePathname();
  useEffect(() => {
    // Start on change, finish shortly after mount to avoid flicker
    NProgress.start();
    const t = setTimeout(() => NProgress.done(), 400);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
