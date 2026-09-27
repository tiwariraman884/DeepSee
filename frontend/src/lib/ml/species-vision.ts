// ─────────────────────────────────────────────────────────────────────────────
// Computer-vision metadata bridge.
//
// Connects the Kaggle-trained classifier (ml/species_classifier.pkl) to the app
// taxonomy. Two things live here:
//
//   1. LABEL_MAP  — Kaggle class -> app species. Without this the model would
//                   emit raw labels like "Turtle_Tortoise" that mean nothing in
//                   the UI.
//   2. Samples    — representative training images exported from the dataset,
//                   shown in the species detail view as model provenance.
//
// Keep the label map in sync with ml/species_label_map.json.
// ─────────────────────────────────────────────────────────────────────────────

import samplesManifest from "@/data/species-samples.json";

/** Kaggle training class -> app species IDs it is allowed to resolve to. */
export const CLASS_TO_SPECIES: Record<string, string[]> = {
  Clams: ["sp-006"],
  Corals: ["sp-003"],
  Crabs: [],
  Dolphin: [],
  Eel: [],
  Fish: ["sp-015"],
  "Jelly Fish": [],
  Lobster: [],
  Nudibranchs: [],
  Octopus: [],
  Otter: ["sp-008"],
  Penguin: ["sp-011"],
  Puffers: [],
  "Sea Rays": ["sp-009"],
  "Sea Urchins": [],
  Seahorse: [],
  Seal: [],
  Sharks: ["sp-004", "sp-018"],
  Shrimp: ["sp-014"],
  Squid: [],
  Starfish: ["sp-017"],
  Turtle_Tortoise: ["sp-001", "sp-007", "sp-012"],
  Whale: ["sp-002", "sp-013", "sp-016"],
};

/** Human-readable form of a raw Kaggle class label. */
export const CLASS_DISPLAY_NAMES: Record<string, string> = {
  Clams: "Clams",
  Corals: "Corals",
  Crabs: "Crabs",
  Dolphin: "Dolphin",
  Eel: "Eel",
  Fish: "Fish",
  "Jelly Fish": "Jellyfish",
  Lobster: "Lobster",
  Nudibranchs: "Nudibranchs",
  Octopus: "Octopus",
  Otter: "Otter",
  Penguin: "Penguin",
  Puffers: "Pufferfish",
  "Sea Rays": "Sea Rays",
  "Sea Urchins": "Sea Urchins",
  Seahorse: "Seahorse",
  Seal: "Seal",
  Sharks: "Sharks",
  Shrimp: "Shrimp",
  Squid: "Squid",
  Starfish: "Starfish",
  Turtle_Tortoise: "Turtle / Tortoise",
  Whale: "Whale",
};

/**
 * Normalise a raw classifier label into a Kaggle class key.
 * The model emits exact folder names, but be defensive about casing/spacing.
 */
export function normalizeClass(raw: string): string {
  if (!raw) return "";
  if (CLASS_TO_SPECIES[raw]) return raw;
  const lower = raw.trim().toLowerCase();
  const match = Object.keys(CLASS_TO_SPECIES).find(
    (k) => k.toLowerCase() === lower || k.toLowerCase().replace(/[\s_]/g, "") === lower.replace(/[\s_]/g, "")
  );
  return match ?? raw.trim();
}

export function displayName(raw: string): string {
  const cls = normalizeClass(raw);
  return CLASS_DISPLAY_NAMES[cls] ?? cls.replace(/[_-]/g, " ");
}

/**
 * Resolve a raw label to the app species it may refer to.
 * Returns [] when the class is absent from the app taxonomy — callers must
 * surface that honestly rather than inventing a match.
 */
export function speciesIdsForClass(raw: string): string[] {
  return CLASS_TO_SPECIES[normalizeClass(raw)] ?? [];
}

/** True when the trained model has no representation of this app species. */
export function isSpeciesUncovered(speciesId: string): boolean {
  return !(speciesId in samplesManifest.samples);
}

/** Training images exported from the Kaggle dataset for a species (may be empty). */
export function trainingSamplesFor(speciesId: string): string[] {
  return (samplesManifest.samples as Record<string, string[]>)[speciesId] ?? [];
}

/** Species the dataset cannot classify, because no training class maps to them. */
export const UNCOVERED_SPECIES: string[] = samplesManifest.uncoveredSpecies;

export const SAMPLES_META = samplesManifest._meta;