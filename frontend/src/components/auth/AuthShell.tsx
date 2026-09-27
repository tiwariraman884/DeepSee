"use client";

import Link from "next/link";
import Image from "next/image";
import { Activity, ShieldAlert, Fish, Sparkles, Globe } from "lucide-react";
import { motion } from "framer-motion";

// Pre-computed stable random values to avoid SSR hydration mismatches
const BUBBLES = Array.from({ length: 15 }, (_, i) => ({
  startX: (i * 7.3 + 3) % 100,
  endX: (i * 7.3 + 3 + (i % 2 === 0 ? 12 : -12)) % 100,
  size: (i % 6) * 4 + 6,
  duration: (i % 4) * 5 + 20,
  delay: (i % 5) * 3,
}));

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  startX: (i * 3.7 + 5) % 100,
  startY: (i * 5.3 + 10) % 100,
  endY: ((i * 5.3 + 10) % 100) - 20,
  size: (i % 3) + 1,
  duration: (i % 4) * 3 + 15,
  delay: (i % 5) * 2,
}));

function AnimatedGradient() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ background: "#030e1a" }}>
      <motion.div
        className="absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(ellipse 80% 70% at 30% 40%, rgba(14, 165, 233, 0.25) 0%, rgba(2, 6, 23, 0) 70%)",
        }}
        animate={{
          x: ["0%", "-8%", "0%", "8%", "0%"],
          y: ["0%", "8%", "0%", "-8%", "0%"],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 70% 70%, rgba(56, 189, 248, 0.2) 0%, transparent 70%)",
        }}
        animate={{
          x: ["0%", "5%", "0%", "-5%", "0%"],
          y: ["0%", "-5%", "0%", "5%", "0%"],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
    </div>
  );
}

function MarineGrid() {
  return (
    <div className="absolute inset-0 z-0 opacity-10 mix-blend-screen overflow-hidden">
      <motion.div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        }}
        animate={{
          backgroundPosition: ["0px 0px", "0px 64px"],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function LightRays() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden mix-blend-screen pointer-events-none">
      <motion.div 
        className="absolute left-[15%] top-[-10%] h-[120%] w-[120px] origin-top rotate-[25deg] bg-gradient-to-b from-white/10 to-transparent blur-2xl"
        animate={{ opacity: [0.2, 0.4, 0.2], rotate: [25, 28, 25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute left-[45%] top-[-10%] h-[120%] w-[180px] origin-top rotate-[25deg] bg-gradient-to-b from-ocean-400/10 to-transparent blur-3xl"
        animate={{ opacity: [0.1, 0.3, 0.1], rotate: [25, 22, 25] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

function FloatingBubbles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden mix-blend-screen">
      {BUBBLES.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white opacity-20"
          initial={{ x: `${b.startX}%`, y: "110%" }}
          animate={{ y: "-10%", x: `${b.endX}%` }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            ease: "linear",
            delay: b.delay,
          }}
          style={{
            width: b.size,
            height: b.size,
            filter: "blur(1px)",
          }}
        />
      ))}
    </div>
  );
}

function OceanParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden mix-blend-screen">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute rounded-full bg-ocean-100"
          initial={{ x: `${p.startX}%`, y: `${p.startY}%`, opacity: 0 }}
          animate={{
            y: [`${p.startY}%`, `${p.endY}%`],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
          style={{
            width: p.size,
            height: p.size,
            boxShadow: "0 0 6px rgba(186, 230, 253, 0.6)",
          }}
        />
      ))}
    </div>
  );
}

function DigitalWaves() {
  return (
    <div className="absolute inset-0 z-0 flex items-end justify-center opacity-[0.07] mix-blend-screen pointer-events-none overflow-hidden pb-32">
      <svg width="200%" height="100%" viewBox="0 0 1600 400" preserveAspectRatio="none">
        <motion.path
          d="M0,200 Q400,100 800,200 T1600,200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white"
          animate={{
            d: [
              "M0,200 Q400,100 800,200 T1600,200",
              "M0,200 Q400,300 800,200 T1600,200",
              "M0,200 Q400,100 800,200 T1600,200"
            ]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M0,250 Q400,350 800,250 T1600,250"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-white"
          animate={{
            d: [
              "M0,250 Q400,350 800,250 T1600,250",
              "M0,250 Q400,150 800,250 T1600,250",
              "M0,250 Q400,350 800,250 T1600,250"
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

function AINetworkLines() {
  return (
    <div className="absolute inset-0 z-0 opacity-[0.08] mix-blend-screen pointer-events-none overflow-hidden">
      <motion.svg 
        width="100%" 
        height="100%"
        animate={{
          x: ["0%", "-2%", "0%"],
          y: ["0%", "2%", "0%"],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      >
        <pattern id="network-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="1.5" fill="currentColor" className="text-white" />
          <circle cx="90" cy="60" r="1" fill="currentColor" className="text-white" />
          <circle cx="50" cy="100" r="1.5" fill="currentColor" className="text-white" />
          <path d="M30,30 L90,60 L50,100 Z" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white" />
        </pattern>
        <rect x="0" y="0" width="200%" height="200%" fill="url(#network-pattern)" />
      </motion.svg>
    </div>
  );
}

function OceanMapSilhouette() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <Globe 
        className="w-[90%] h-[90%] text-sky-400" 
        strokeWidth={0.3}
        style={{ opacity: 0.06 }}
      />
    </div>
  );
}

function StatItem({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className="flex flex-col gap-1"
    >
      <span className="text-2xl font-bold tracking-tight text-white/90">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-white/40">{label}</span>
    </motion.div>
  );
}

function Highlight({ icon: Icon, text, delay }: { icon: any; text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className="flex items-center gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/5 text-white/80 shadow-sm backdrop-blur-md">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-white/70">{text}</span>
    </motion.div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-abyss-950">
      {/* LEFT PANEL: Immersive Branding */}
      <div className="relative hidden md:flex w-[45%] shrink-0 flex-col justify-between overflow-hidden">
        
        {/* Background Layers */}
        <AnimatedGradient />
        <OceanMapSilhouette />
        <MarineGrid />
        <AINetworkLines />
        <LightRays />
        <DigitalWaves />
        <OceanParticles />
        <FloatingBubbles />

        {/* Top Logo */}
        <div className="relative z-10 p-10">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg backdrop-blur-md">
              <Image
                src="/logo-icon.png"
                alt="DeepSea Guardian"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold text-white/90 tracking-tight">DeepSea Guardian</span>
          </Link>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 flex-1 p-10 pt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="rounded-3xl border border-white/10 bg-abyss-950/20 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden"
          >
            {/* Inner glow for glassmorphism */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Powered Ocean Intelligence</span>
              </div>
              <h2 className="mb-4 text-4xl font-bold leading-tight text-white/90">
                Protecting the Ocean with Advanced Artificial Intelligence.
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-white/50">
                A mission control platform for real-time ocean intelligence, predictive analytics, and marine conservation. Join thousands of researchers globally.
              </p>

              <div className="mb-8 flex flex-col gap-4">
                <Highlight icon={Activity} text="Real-time Ocean Monitoring" delay={0.2} />
                <Highlight icon={ShieldAlert} text="AI Risk Prediction" delay={0.3} />
                <Highlight icon={Fish} text="Biodiversity Protection" delay={0.4} />
              </div>

              <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                <StatItem value="195+" label="Countries Protected" delay={0.5} />
                <StatItem value="1.2M" label="Active Ocean Sensors" delay={0.6} />
                <StatItem value="85K" label="Pollution Events Detected" delay={0.7} />
                <StatItem value="10K+" label="Species Monitored" delay={0.8} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Trusted By */}
        <div className="relative z-10 p-10">
          <p className="mb-4 text-[10px] uppercase tracking-widest text-white/30">Trusted by Global Organizations</p>
          <div className="flex flex-wrap items-center gap-8 opacity-30 grayscale">
            <span className="text-xl font-bold text-white">UNEP</span>
            <span className="text-xl font-bold text-white">UNESCO</span>
            <span className="text-xl font-bold text-white">WWF</span>
            <span className="text-xl font-bold text-white">NOAA</span>
            <span className="text-xl font-bold text-white">IUCN</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Auth Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-6 md:p-10 bg-abyss-950">
        <Link href="/" className="mb-8 flex items-center gap-2 md:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white/5 border border-white/10">
            <Image
              src="/logo-icon.png"
              alt="DeepSea Guardian"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <span className="text-xl font-bold text-white/90">DeepSea Guardian</span>
        </Link>
        <div className="w-full max-w-[420px] relative z-10">
          {children}
        </div>
      </div>
    </main>
  );
}
