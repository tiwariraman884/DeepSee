"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/map/OceanMap";
import type { Coordinates } from "@/types";

// Declared before the dynamic() call below: the loading fallback closes over it,
// and a `let` in the temporal dead zone would throw on first render.
let lastMapHeight = "420px";

const OceanMapInner = dynamic(
  () =>
    import("@/components/map/OceanMap")
      .then((m) => m.OceanMap)
      .catch(() => {
        const Fallback = () => (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-abyss-950 text-sm text-ocean-200/50">
            Map unavailable
          </div>
        );
        return Fallback;
      }),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: lastMapHeight }}
        className="flex w-full items-center justify-center rounded-xl bg-abyss-950 text-sm text-ocean-200/50"
      >
        Loading ocean map…
      </div>
    ),
  }
);

export function OceanMap(props: {
  points: MapPoint[];
  routes?: { id: string; path: Coordinates[]; color?: string }[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (id: string) => void;
  onViewportChange?: (center: [number, number], zoom: number) => void;
}) {
  const height = props.height ?? "420px";
  // Remember the height for the *next* loading fallback. Assigning during render
  // is safe here because the value is only read by a fallback that renders after
  // this component has mounted.
  lastMapHeight = height;
  return <OceanMapInner {...props} height={height} />;
}
