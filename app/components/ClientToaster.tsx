"use client";

import { Toaster } from "sonner";
import { useEffect, useState } from "react";

export default function ClientToaster() {
  // Render only after mount so the server-rendered HTML matches the client
  // (sonner injects DOM that isn't present during SSR → hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return <Toaster richColors position="top-right" closeButton />;
}
