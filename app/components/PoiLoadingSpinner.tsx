"use client";

import { useEffect, useState, useMemo } from "react";

const STEPS = [
  { label: "Fetching POI Data", icon: "📍", detail: "Connecting to data streams..." },
  { label: "Processing Locations", icon: "⚙️", detail: "Mapping coordinates..." },
  { label: "Analyzing Facilities", icon: "🔍", detail: "Running AI analysis..." },
  { label: "Finalizing Report", icon: "✨", detail: "Assembling insights..." },
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600;700&family=Space+Mono:wght@400;700&display=swap');

  @keyframes floatUp {
    0%   { transform: translateY(0) scale(1); opacity: 0.8; }
    100% { transform: translateY(-80px) scale(0.2); opacity: 0; }
  }
  @keyframes spinCW  { to { transform: rotate(360deg);  } }
  @keyframes spinCCW { to { transform: rotate(-360deg); } }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 8px rgba(59,130,246,.4); }
    50%      { box-shadow: 0 0 22px rgba(99,102,241,.9), 0 0 40px rgba(59,130,246,.3); }
  }
  @keyframes scanline {
    0%   { top: -4px; opacity: 0; }
    5%   { opacity: .35; }
    95%  { opacity: .35; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes glitch {
    0%,94%,100% { clip-path: none; transform: translate(0); }
    95% { clip-path: polygon(0 20%,100% 20%,100% 40%,0 40%); transform: translate(-2px,1px); }
    97% { clip-path: polygon(0 60%,100% 60%,100% 80%,0 80%); transform: translate(2px,-1px); }
    98% { clip-path: none; transform: translate(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes ripple {
    0%   { transform: scale(1);   opacity: .6; }
    100% { transform: scale(2.6); opacity:  0; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0);    }
  }

  .poi-ring-1 { animation: spinCW  3s linear infinite; }
  .poi-ring-2 { animation: spinCCW 5s linear infinite; }
  .poi-ring-3 { animation: spinCW  8s linear infinite; }
  .poi-scan   { animation: scanline 3s ease-in-out infinite; }
  .poi-glitch { animation: glitch 7s infinite; }
  .poi-step-active { animation: slideIn .3s ease-out; }
`;

export default function PoiLoadingSpinner() {
  const [progress, setProgress]        = useState<number>(0);
  const [currentStep, setCurrentStep]  = useState<number>(0);
  const [completedSteps, setCompleted] = useState<number[]>([]);

  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id:      i,
      left:    Math.random() * 100,
      dur:     2 + Math.random() * 4,
      delay:   Math.random() * 4,
      size:    1.5 + Math.random() * 2.5,
      opacity: 0.3 + Math.random() * 0.6,
      color:   i % 2 === 0 ? "99,179,237" : "139,92,246",
    })),
  []);

  useEffect(() => {
    const iv1 = setInterval(() => {
      setProgress((p: number) => {
        const next = p + Math.random() * 2.2;
        return next > 95 ? 95 : next;
      });
    }, 120);

    const iv2 = setInterval(() => {
      setCurrentStep((prev: number) => {
        setCompleted((c: number[]) =>
          c.includes(prev) ? c : [...c, prev]
        );
        return (prev + 1) % STEPS.length;
      });
    }, 2000);

    return () => {
      clearInterval(iv1);
      clearInterval(iv2);
    };
  }, []);

  return (
    <>
      <style>{css}</style>

      <div style={{
        background: "linear-gradient(135deg,#0a0e1a 0%,#0d1224 50%,#0a1628 100%)",
        borderRadius: 24,
        padding: "36px 28px",
        width: 340,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(59,130,246,.15),0 0 120px rgba(99,102,241,.08),inset 0 1px 0 rgba(255,255,255,.05)",
        border: "1px solid rgba(99,179,237,.12)",
        fontFamily: "'DM Sans',sans-serif",
      }}>

        {/* Grid bg */}
        <div style={{
          position: "absolute", inset: 0, opacity: .04,
          backgroundImage: "linear-gradient(rgba(99,179,237,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,179,237,1) 1px,transparent 1px)",
          backgroundSize: "20px 20px", pointerEvents: "none",
        }} />

        {/* Scanline */}
        <div className="poi-scan" style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg,transparent,rgba(99,179,237,.3),transparent)",
          zIndex: 1,
        }} />

        {/* Particles */}
        {particles.map(pt => (
          <div key={pt.id} style={{
            position: "absolute",
            left: `${pt.left}%`,
            bottom: 0,
            width: pt.size,
            height: pt.size,
            borderRadius: "50%",
            background: `rgba(${pt.color},${pt.opacity})`,
            animation: `floatUp ${pt.dur}s ease-in ${pt.delay}s infinite`,
            pointerEvents: "none",
          }} />
        ))}

        {/* Orbital Core */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div style={{ position: "relative", width: 100, height: 100 }}>

            {/* Ambient glow */}
            <div style={{
              position: "absolute", inset: -12, borderRadius: "50%",
              background: "radial-gradient(circle,rgba(59,130,246,.08) 0%,transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Ring 3 — outermost */}
            <div className="poi-ring-3" style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1px dashed rgba(99,179,237,.15)",
            }}>
              <div style={{
                position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)",
                width: 5, height: 5, borderRadius: "50%",
                background: "rgba(99,179,237,.45)",
              }} />
            </div>

            {/* Ring 2 */}
            <div className="poi-ring-2" style={{
              position: "absolute", inset: 10, borderRadius: "50%",
              border: "1.5px solid rgba(139,92,246,.3)",
              boxShadow: "0 0 8px rgba(139,92,246,.1)",
            }}>
              <div style={{
                position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                width: 8, height: 8, borderRadius: "50%",
                background: "linear-gradient(135deg,#8b5cf6,#6366f1)",
                boxShadow: "0 0 10px rgba(139,92,246,.9)",
              }} />
            </div>

            {/* Ring 1 */}
            <div className="poi-ring-1" style={{
              position: "absolute", inset: 22, borderRadius: "50%",
              border: "2px solid rgba(59,130,246,.45)",
              boxShadow: "0 0 12px rgba(59,130,246,.15),inset 0 0 12px rgba(59,130,246,.05)",
            }}>
              <div style={{
                position: "absolute", top: -5, right: 3,
                width: 9, height: 9, borderRadius: "50%",
                background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
                boxShadow: "0 0 14px rgba(59,130,246,1)",
              }} />
            </div>

            {/* Core */}
            <div style={{
              position: "absolute", inset: 32, borderRadius: "50%",
              background: "linear-gradient(135deg,#1e3a5f,#1a1f3a)",
              border: "2px solid rgba(59,130,246,.5)",
              animation: "pulseGlow 2s ease-in-out infinite",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 2, fontSize: 14,
            }}>
              {STEPS[currentStep].icon}
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            fontFamily: "'Space Mono',monospace", fontSize: 10,
            letterSpacing: "0.25em", color: "rgba(99,179,237,.55)",
            textTransform: "uppercase", marginBottom: 6,
          }}>
            System Active
          </div>
          <h3 className="poi-glitch" style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700,
            color: "#e2e8f0", margin: 0, letterSpacing: "-0.3px",
          }}>
            Analyzing Location 
          </h3>
          <p style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            color: "rgba(148,163,184,.65)", margin: "6px 0 0",
          }}>
            {STEPS[currentStep].detail}
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone   = completedSteps.includes(i);
            return (
              <div
                key={i}
                className={isActive ? "poi-step-active" : ""}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  border: isActive ? "1px solid rgba(59,130,246,.4)"
                        : isDone   ? "1px solid rgba(52,211,153,.2)"
                        :            "1px solid rgba(255,255,255,.04)",
                  background: isActive ? "rgba(59,130,246,.08)"
                            : isDone   ? "rgba(52,211,153,.05)"
                            :            "rgba(255,255,255,.02)",
                  transition: "all .4s ease",
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Shimmer on active */}
                {isActive && (
                  <div style={{
                    position: "absolute", inset: 0, pointerEvents: "none",
                    background: "linear-gradient(90deg,transparent 0%,rgba(59,130,246,.07) 50%,transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s linear infinite",
                  }} />
                )}

                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                            : isDone   ? "linear-gradient(135deg,#10b981,#34d399)"
                            :            "rgba(255,255,255,.06)",
                  boxShadow: isActive ? "0 0 14px rgba(59,130,246,.7)"
                           : isDone   ? "0 0 10px rgba(52,211,153,.5)"
                           :            "none",
                  fontSize: 13, transition: "all .4s ease", position: "relative",
                }}>
                  {isDone ? "✓" : step.icon}
                  {isActive && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      border: "2px solid rgba(99,179,237,.5)",
                      animation: "ripple 1.2s ease-out infinite",
                    }} />
                  )}
                </div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                    color: isActive ? "#93c5fd" : isDone ? "#6ee7b7" : "rgba(148,163,184,.45)",
                    transition: "color .4s",
                  }}>
                    {step.label}
                  </div>
                </div>

                {/* Badge */}
                <div style={{
                  fontFamily: "'Space Mono',monospace", fontSize: 9,
                  letterSpacing: "0.1em", padding: "2px 7px", borderRadius: 999,
                  color:      isActive ? "#93c5fd" : isDone ? "#6ee7b7" : "rgba(100,116,139,.4)",
                  background: isActive ? "rgba(59,130,246,.15)" : isDone ? "rgba(52,211,153,.1)" : "transparent",
                  border:     isActive ? "1px solid rgba(59,130,246,.3)" : isDone ? "1px solid rgba(52,211,153,.2)" : "1px solid transparent",
                  flexShrink: 0,
                }}>
                  {isActive ? "ACTIVE" : isDone ? "DONE" : "WAIT"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{
              fontFamily: "'Space Mono',monospace", fontSize: 10,
              letterSpacing: "0.15em", color: "rgba(99,179,237,.5)", textTransform: "uppercase",
            }}>
              Progress
            </span>
            <span style={{
              fontFamily: "'Space Mono',monospace", fontSize: 15, fontWeight: 700,
              color: "#60a5fa", textShadow: "0 0 12px rgba(59,130,246,.7)",
            }}>
              {Math.round(progress)}%
            </span>
          </div>

          <div style={{
            width: "100%", height: 6, background: "rgba(255,255,255,.06)",
            borderRadius: 999, overflow: "hidden",
            border: "1px solid rgba(255,255,255,.05)", position: "relative",
          }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)",
              borderRadius: 999, transition: "width .3s ease", position: "relative",
              boxShadow: "0 0 10px rgba(99,102,241,.7),0 0 20px rgba(59,130,246,.3)",
            }}>
              <div style={{
                position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                width: 8, height: 8, borderRadius: "50%", background: "white",
                boxShadow: "0 0 8px rgba(255,255,255,.9),0 0 18px rgba(99,102,241,1)",
              }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {[0, 25, 50, 75, 100].map(v => (
              <span key={v} style={{
                fontFamily: "'Space Mono',monospace", fontSize: 9,
                color: progress >= v ? "rgba(99,179,237,.5)" : "rgba(100,116,139,.25)",
                transition: "color .5s",
              }}>
                {v}
              </span>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}