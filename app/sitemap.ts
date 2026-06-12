import type { MetadataRoute } from "next";

const SITE_URL = "https://zonalvalue.ph";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    // The public landing page (anonymous visitors are routed here).
    { url: `${SITE_URL}/welcome`, lastModified: now, changeFrequency: "weekly", priority: 1 },
  ];
}
