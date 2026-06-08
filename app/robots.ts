import type { MetadataRoute } from "next";

const SITE_URL = "https://zonal.leuteriorealty.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/welcome"],
        // Private / non-content routes — no value to index
        disallow: ["/dashboard", "/admin", "/api", "/login", "/register"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
