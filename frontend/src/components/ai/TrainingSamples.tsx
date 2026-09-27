"use client";

import Image from "next/image";
import { BrainCircuit, Info } from "lucide-react";
import { trainingSamplesFor, SAMPLES_META } from "@/lib/ml/species-vision";

/**
 * Shows the actual imagery the computer-vision model was trained on for a
 * given species, exported from the Kaggle sea-animals dataset.
 *
 * Renders nothing when the dataset has no coverage for the species — an empty
 * carousel would imply the model knows this animal when it does not.
 */
export function TrainingSamples({
  speciesId,
  speciesName,
}: {
  speciesId: string;
  speciesName: string;
}) {
  const samples = trainingSamplesFor(speciesId);
  if (samples.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
        <BrainCircuit className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        Model Training Samples
        <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-text-muted">
          {samples.length}
        </span>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-text-muted">
        Reference images from the {SAMPLES_META.dataset} dataset used to teach the classifier
        what {speciesName} looks like.
      </p>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {samples.map((src, i) => (
          <div
            key={src}
            className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-control border border-white/10 bg-black/40"
          >
            <Image
              src={src}
              alt={`${speciesName} training sample ${i + 1}`}
              fill
              sizes="128px"
              loading="lazy"
              decoding="async"
              quality={70}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-text-muted/80">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          Exported from the training dataset, not live observation footage.
        </span>
      </p>
    </div>
  );
}