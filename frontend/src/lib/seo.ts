import type { Metadata } from "next";

const SITE = "https://deepsea-guardian.example.org";

export function routeMetadata({
  title,
  description,
  path = "",
}: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const url = `${SITE}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · DeepSea Guardian`,
      description,
      url,
      siteName: "DeepSea Guardian",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DeepSea Guardian" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · DeepSea Guardian`,
      description,
      images: ["/opengraph-image"],
    },
  };
}
