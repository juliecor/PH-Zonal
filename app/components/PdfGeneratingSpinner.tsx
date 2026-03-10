"use client";

import { useEffect, useState } from "react";

export default function PdfGeneratingSpinner({ step = 0 }: { step?: number }) {
  const [displayStep, setDisplayStep] = useState(0);

  const steps = [
    { label: "Rendering Map Screenshot", icon: "🗺️", duration: 2000 },
    { label: "Compiling Report Data", icon: "📋", duration: 2000 },
    { label: "Formatting PDF Layout", icon: "📄", duration: 2000 },
    { label: "Finalizing PDF", icon: "✅", duration: 1500 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayStep((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="w-full space-y-4 p-6 bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 rounded-lg border border-amber-200">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Generating PDF Report</h3>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((s, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
              index === displayStep ? "bg-white shadow-md border border-amber-300" : "bg-gray-50 opacity-60"
            }`}
          >
            <span
              className={`text-lg transition-transform ${index === displayStep ? "animate-spin text-xl" : ""}`}
            >
              {s.icon}
            </span>
            <span
              className={`text-xs font-semibold transition-colors ${
                index === displayStep ? "text-amber-600" : "text-gray-600"
              }`}
            >
              {s.label}
            </span>
            {index === displayStep && (
              <div className="ml-auto w-3 h-3 rounded-full border-2 border-transparent border-t-amber-500 border-r-amber-500 animate-spin" />
            )}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-500"
          style={{ width: `${((displayStep + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
