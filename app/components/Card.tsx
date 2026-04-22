"use client";

import React from "react";

type Props = React.PropsWithChildren<{
  padding?: boolean;
  className?: string;
  style?: React.CSSProperties;
}>;

export default function Card({ padding = true, className = "", style, children }: Props) {
  return (
    <div
      className={
        "zv-card bg-white border border-[#e8e0d8] shadow-[0_2px_14px_rgba(15,31,56,0.05)] rounded-[14px] " +
        (padding ? "p-4 " : "") +
        className
      }
      style={style}
    >
      {children}
    </div>
  );
}
