export const oceanRegions = [
  "Pacific Ocean",
  "Atlantic Ocean",
  "Indian Ocean",
  "Arctic Ocean",
  "Southern Ocean",
  "Mediterranean Sea",
  "Caribbean Sea",
  "Coral Triangle",
  "North Pacific Gyre",
  "Gulf of California",
] as const;

export type Region = (typeof oceanRegions)[number];
