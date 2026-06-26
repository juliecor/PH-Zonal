import type { Metadata } from "next";

// Preview of the new landing (the Philippines-in-value intro). Lives at /welcome-new so the
// current /welcome and the map at / stay untouched; we swap it in when approved.
export const metadata: Metadata = {
  title: "Zonal Value Finder — The Philippines, in value",
  description:
    "Official BIR zonal values in pesos per square meter, a six-point geohazard profile, and an AI analyst — for any address from Batanes to Tawi-Tawi. By Filipino Homes & Leuterio Realty.",
  alternates: { canonical: "/welcome-new" },
  robots: { index: false, follow: false }, // preview route — keep it out of search until it's live
  openGraph: {
    title: "Zonal Value Finder — The Philippines, in value",
    description:
      "Official BIR zonal values, a six-point geohazard profile, and an AI analyst — for any address from Batanes to Tawi-Tawi.",
    url: "https://zonalvalue.ph/welcome-new",
  },
};

export default function WelcomeNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
