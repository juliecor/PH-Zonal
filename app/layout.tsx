import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import ClientToaster from "./components/ClientToaster";
import RouteProgress from "./components/RouteProgress";
import "leaflet/dist/leaflet.css";
import ThemeRegistry from "./mui/ThemeRegistry";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const SITE_URL = "https://zonalvalue.ph";
const SITE_DESCRIPTION =
  "Look up BIR zonal values street-by-street for every province, city, and barangay in the Philippines. Map-based search, nearby facilities, land-area measurement, and instant PDF reports — by Filipino Homes & Leuterio Realty.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zonal Value Finder — BIR Zonal Values Across the Philippines | Filipino Homes",
    template: "%s | FH Zonal Finder",
  },
  description: SITE_DESCRIPTION,
  applicationName: "FH Zonal Finder",
  keywords: [
    "zonal value",
    "BIR zonal value",
    "Philippines zonal value",
    "zonal value Cebu",
    "land value per sqm",
    "property valuation Philippines",
    "real estate Philippines",
    "Filipino Homes",
    "Leuterio Realty",
    "barangay zonal value",
  ],
  authors: [{ name: "Filipino Homes" }],
  creator: "Filipino Homes",
  publisher: "Leuterio Realty",
  alternates: { canonical: "/" },
  icons: {
    icon: "/pictures/filipinohomespointer.png",
    shortcut: "/pictures/filipinohomespointer.png",
    apple: "/pictures/filipinohomespointer.png",
  },
  openGraph: {
    type: "website",
    siteName: "FH Zonal Finder",
    url: SITE_URL,
    title: "Zonal Value Finder — BIR Zonal Values Across the Philippines",
    description: SITE_DESCRIPTION,
    locale: "en_PH",
    images: [{ url: "/pictures/3d-fh.png", alt: "FH Zonal Finder by Filipino Homes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zonal Value Finder — BIR Zonal Values Across the Philippines",
    description: SITE_DESCRIPTION,
    images: ["/pictures/3d-fh.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Set GOOGLE_SITE_VERIFICATION in your env to verify ownership in Search Console
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "FH Zonal Finder",
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "PHP" },
    publisher: {
      "@type": "Organization",
      name: "Leuterio Realty & Brokerage / Filipino Homes",
      url: "https://www.leuteriorealty.com",
      logo: `${SITE_URL}/pictures/LeuterioRealty.png`,
    },
  };

  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeRegistry>
          <RouteProgress />
          <ClientToaster />
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
