import type { MetadataRoute } from "next";
import { pollution } from "@/data/pollution.json";
import { species } from "@/data/species.json";
import { drones } from "@/data/drones.json";

const BASE_URL = "https://deepsea-guardian.example.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/login",
    "/signup",
    "/dashboard",
    "/map",
    "/pollution",
    "/species",
    "/risk",
    "/drones",
    "/reports",
    "/assistant",
    "/alerts",
    "/innovation",
    "/about",
  ];

  const dynamicRoutes = [
    ...pollution.map((p) => `/pollution/${p.id}`),
    ...species.map((s) => `/species/${s.id}`),
    ...drones.map((d) => `/drones/${d.id}`),
  ];

  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${BASE_URL}${route}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    ...dynamicRoutes.map((route) => ({
      url: `${BASE_URL}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
