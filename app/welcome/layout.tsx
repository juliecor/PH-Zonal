import type { Metadata } from "next";

// Public landing page — its own SEO metadata (the page component is a Client
// Component, so metadata must live in this server layout).
export const metadata: Metadata = {
  title: "Zonal Value Finder — BIR Zonal Values Across the Philippines",
  description:
    "Discover precise BIR zonal values street-by-street for every province, city, and barangay in the Philippines. Built for real estate professionals by Filipino Homes & Leuterio Realty.",
  alternates: { canonical: "/welcome" },
  openGraph: {
    title: "Zonal Value Finder — BIR Zonal Values Across the Philippines",
    description:
      "Precise BIR zonal values street-by-street for every province, city, and barangay in the Philippines.",
    url: "https://zonal.leuteriorealty.com/welcome",
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
