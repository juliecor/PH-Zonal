"use client";

import React from "react";

type Tone = "neutral" | "gold" | "navy" | "success" | "warning";

type Props = React.PropsWithChildren<{
  tone?: Tone;
  className?: string;
  style?: React.CSSProperties;
}>;

const toneStyles: Record<Tone, { bg: string; border: string; color: string }> = {
  neutral: { bg: "#f5f0eb", border: "#e8e0d8", color: "#374151" },
  gold: { bg: "rgba(201,168,76,0.12)", border: "rgba(201,168,76,0.35)", color: "#7a5f16" },
  navy: { bg: "#dbeafe", border: "#bfdbfe", color: "#1e3a8a" },
  success: { bg: "#dcfce7", border: "#86efac", color: "#065f46" },
  warning: { bg: "#fef3c7", border: "#fde68a", color: "#92400e" },
};

export default function Badge({ tone = "neutral", className = "", style, children }: Props) {
  const t = toneStyles[tone];
  return (
    <span
      className={"zv-badge inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.7rem] font-semibold whitespace-nowrap " + className}
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color, ...style }}
    >
      {children}
    </span>
  );
}
