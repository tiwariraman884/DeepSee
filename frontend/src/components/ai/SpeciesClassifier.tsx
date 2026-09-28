"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Search, CheckCircle2, Sparkles, Upload, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { statusLabels } from "@/lib/constants";

const SAMPLE_PRESETS = [
  { name: "Hawksbill Turtle", file: "/species/hawksbill-turtle.webp" },
  { name: "Blue Whale", file: "/species/blue-whale.webp" },
  { name: "Clownfish", file: "/species/clownfish.webp" },
  { name: "Hammerhead Shark", file: "/species/hammerhead-shark.webp" },
];

type SpeciesMatch = {
  id: string;
  name: string;
  scientificName: string;
  status: string;
  habitat: string;
  region: string;
  image?: string;
};

type ClassifyResult = {
  species: string;
  confidence: number;
  /** Raw Kaggle dataset class name, e.g. "Turtle_Tortoise" */
  label?: string;
  /** Friendly form of the label, e.g. "Turtle / Tortoise" */
  displayName?: string;
  /** False when the model's class has no counterpart in the app taxonomy */
  covered?: boolean;
  matches?: SpeciesMatch[];
};

export function SpeciesClassifier() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setImagePreview(b64);
      runClassifier(b64);
    };
    reader.readAsDataURL(file);
  };

  const loadSample = async (samplePath: string) => {
    try {
      const response = await fetch(samplePath);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        setImagePreview(b64);
        runClassifier(b64);
      };
      reader.readAsDataURL(blob);
    } catch {
      setImagePreview(samplePath);
      runClassifier(samplePath);
    }
  };

  const runClassifier = async (customImg?: string) => {
    const imgToClassify = customImg || imagePreview;
    if (!imgToClassify) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/species/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_b64: imgToClassify }),
      });
      // Guard: a non-JSON response (HTML error page, empty body from a hung
      // proxy) makes res.json() throw SyntaxError before we can show a message.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.error(`[SpeciesClassifier] Non-JSON response (${res.status}) from /api/species/classify`);
        return;
      }
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setResult(data as ClassifyResult);
      } else if (!res.ok) {
        console.error("[SpeciesClassifier] Classification failed:", data?.error ?? res.status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-emerald-500/20 bg-abyss-950/80 p-5 shadow-xl">
      <CardHeader
        icon={<Camera className="w-5 h-5 text-emerald-400" />}
        title="AI Species Identifier"
        subtitle="Drone Vision Camera Feed · Real-time Marine Species Computer Vision Classifier"
      />

      {/* SAMPLE TEST BUTTONS */}
      <div className="mt-3 mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/80 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> 1-Click Test Samples:
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => loadSample(p.file)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 active:scale-95"
            >
              🐟 {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Upload Area */}
        <div
          className="border-2 border-dashed border-slate-700/80 rounded-xl p-6 flex flex-col items-center justify-center text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors cursor-pointer relative overflow-hidden h-44 bg-black/30"
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL from FileReader (uploads) is not supported by next/image
            <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-contain bg-black/70 p-2" />
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-8 h-8 mb-2 text-emerald-400 animate-bounce" />
              <span className="text-sm font-semibold text-white">Click or Drag & Drop Fish Image Here</span>
              <span className="text-xs text-ocean-200/50 mt-1">Supports PNG, JPG, WEBP formats</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <button
          type="button"
          onClick={() => runClassifier()}
          disabled={!imagePreview || loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Classifying Marine Life with AI…</>
          ) : (
            <><Search className="w-4 h-4" /> Run AI Species Classification</>
          )}
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 shadow-lg"
            >
              {/* Headline: raw label + confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      {result.covered === false ? "Closest Training Class" : "Identified Marine Species"}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {result.displayName || result.species}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-ocean-200/60">AI Confidence</div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Raw dataset label — transparency about what the model really output */}
              {result.label && (
                <p className="mt-3 border-t border-emerald-500/20 pt-2 text-[10px] text-ocean-200/50">
                  Dataset class: <span className="font-mono text-ocean-200/80">{result.label}</span>
                </p>
              )}

              {/* Mapped app species */}
              {result.matches && result.matches.length > 0 && (
                <div className="mt-3 border-t border-emerald-500/20 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
                    Matches in monitored species
                  </p>
                  <div className="space-y-2">
                    {result.matches.map((m) => (
                      <Link
                        key={m.id}
                        href="/species"
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        {m.image && (
                          <Image
                            src={m.image}
                            alt={m.name}
                            width={64}
                            height={40}
                            className="h-10 w-16 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                          <p className="truncate text-[11px] italic text-ocean-200/60">
                            {m.scientificName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-ocean-200/60">{m.region}</p>
                          <p className="text-[10px] font-medium text-emerald-300/80">
                            {statusLabels[m.status as keyof typeof statusLabels] ?? m.status}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ocean-200/40" />
                      </Link>
                    ))}
                  </div>
                  {result.matches.length > 1 && (
                    <p className="mt-2 text-[10px] leading-snug text-ocean-200/50">
                      The dataset groups these together, so the model cannot separate them —
                      all are plausible matches.
                    </p>
                  )}
                </div>
              )}

              {/* Honest coverage gap — never pretend an unmapped class is a match */}
              {result.covered === false && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] leading-snug text-amber-200/90">
                    This class exists in the training dataset but not in the monitored species
                    list, so no species profile can be shown. Treat this as a category-level
                    detection only.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
