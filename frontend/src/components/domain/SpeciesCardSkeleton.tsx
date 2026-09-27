import { cn } from "@/lib/utils";

export function SpeciesCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass flex h-full flex-col overflow-hidden rounded-card",
        className
      )}
      aria-hidden="true"
    >
      <div className="aspect-video w-full animate-pulse bg-secondary/60" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary/60" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-20 animate-pulse rounded bg-secondary/40" />
          <div className="h-3 w-16 animate-pulse rounded bg-secondary/40" />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-control border border-white/5 bg-white/[0.03] p-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 w-12 animate-pulse rounded bg-secondary/40" />
              <div className="h-4 w-10 animate-pulse rounded bg-secondary/60" />
            </div>
          ))}
        </div>
        <div className="h-8 w-full animate-pulse rounded bg-secondary/40" />
        <div className="h-3 w-full animate-pulse rounded bg-secondary/30" />
      </div>
    </div>
  );
}
