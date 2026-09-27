"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Search, CheckCircle2, Sparkles, Upload } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

const SAMPLE_PRESETS = [
  { name: "Hawksbill Turtle", file: "/species/hawksbill-turtle.webp" },
  { name: "Blue Whale", file: "/species/blue-whale.webp" },
  { name: "Clownfish", file: "/species/clownfish.webp" },
  { name: "Hammerhead Shark", file: "/species/hammerhead-shark.webp" },
];

export function SpeciesClassifier() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ species: string; confidence: number } | null>(null);
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
      const data = await res.json();
      if (data.status === "success") {
        setResult({ species: data.species, confidence: data.confidence });
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
              className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Identified Marine Species</div>
                  <div className="text-lg font-bold text-white">{result.species}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-ocean-200/60 uppercase">AI Confidence</div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {(result.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
