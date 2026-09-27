import { species } from "@/data/species.json";
import { formatNumber } from "@/lib/utils";

export function ConservationMeter() {
  const avg =
    species.reduce((s, x) => s + x.conservationProgress, 0) / species.length;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ocean-200/70">Avg. Recovery Progress</span>
        <span className="text-2xl font-bold text-biolum-400">
          {avg.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-abyss-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-biolum-600 to-biolum-400"
          style={{ width: `${avg}%` }}
        />
      </div>
      <div className="mt-4 space-y-2">
        {species.slice(0, 4).map((s) => (
          <div key={s.id} className="text-xs">
            <div className="flex justify-between text-ocean-200/70">
              <span>{s.name}</span>
              <span>{formatNumber(s.population[s.population.length - 1])}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-abyss-800">
              <div
                className="h-full bg-ocean-500"
                style={{ width: `${s.conservationProgress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
