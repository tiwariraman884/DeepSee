import Link from "next/link";
import { Waves, Target, Eye, ArrowRight, Globe2, Shield, Leaf, Fish, AlertTriangle } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Our Mission",
  description:
    "Discover DeepSea Guardian's mission to protect our oceans using AI, satellite imagery, underwater drones, and environmental analytics for a sustainable future.",
  path: "/mission",
});

const sdgs = [
  { num: "14", title: "Life Below Water", desc: "Conserve and sustainably use the oceans, seas and marine resources." },
  { num: "13", title: "Climate Action", desc: "Take urgent action to combat climate change and its impacts." },
  { num: "15", title: "Life on Land", desc: "Protect, restore and promote sustainable use of terrestrial ecosystems." },
];

const problems = [
  {
    icon: AlertTriangle,
    title: "Plastic Pollution",
    stat: "8M+",
    statLabel: "tons of plastic enter oceans annually",
    desc: "Microplastics contaminate the food chain, damage marine ecosystems, and threaten human health. DeepSea Guardian detects pollution hotspots in real time using AI-powered satellite analysis.",
  },
  {
    icon: Globe2,
    title: "Illegal Fishing",
    stat: "30%",
    statLabel: "of global catch is illegal",
    desc: "Overfishing depletes fish stocks, destroys habitats, and undermines coastal economies. Our platform tracks vessel movements and identifies illegal activity using AIS data and computer vision.",
  },
  {
    icon: Fish,
    title: "Biodiversity Loss",
    stat: "90%",
    statLabel: "of large fish stocks depleted",
    desc: "Habitat destruction, pollution, and climate change are driving species extinction. DeepSea Guardian monitors marine biodiversity and flags at-risk ecosystems before irreversible damage occurs.",
  },
  {
    icon: Shield,
    title: "Coral Bleaching",
    stat: "50%",
    statLabel: "of coral reefs lost since 1950",
    desc: "Rising ocean temperatures cause mass bleaching events. Our AI models predict bleaching risk up to 5 years in advance, enabling proactive conservation interventions.",
  },
];

export default function MissionPage() {
  return (
    <main id="main-content" className="overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-500/20 text-ocean-300">
              <Waves className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-white">DeepSea Guardian</span>
          </Link>
          <Link href="/dashboard" className="rounded-xl bg-ocean-500 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-400">
            Launch Dashboard
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Target className="h-3.5 w-3.5" /> Our Mission
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Protecting the Ocean for{" "}
            <span className="gradient-text">Future Generations</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            We believe that advanced technology can reverse the damage humanity has inflicted on our oceans.
            DeepSea Guardian combines AI, satellite imagery, and autonomous systems to give the ocean a voice.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Why Ocean Conservation Matters</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ocean-200/70">
            The ocean produces 50% of the world&apos;s oxygen, absorbs 25% of CO₂ emissions, and supports billions of livelihoods. Its collapse would be catastrophic.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {problems.map((p) => (
              <div key={p.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{p.title}</h3>
                    <p className="text-xs text-ocean-200/60">{p.statLabel}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ocean-200/70">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Sustainable Development Goals</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ocean-200/70">
            DeepSea Guardian directly contributes to the UN 2030 Agenda for Sustainable Development.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {sdgs.map((sdg) => (
              <div key={sdg.num} className="glass rounded-2xl p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ocean-500/20 text-xl font-bold text-ocean-300">
                  {sdg.num}
                </div>
                <h3 className="mt-4 font-semibold text-white">{sdg.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{sdg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Join the Mission</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Whether you&apos;re a researcher, policymaker, or conservationist — DeepSea Guardian gives you the tools to make a difference.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
              Explore Platform <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-ocean-500/30 px-6 py-3 text-sm font-semibold text-ocean-100 hover:bg-ocean-500/10">
              Partner With Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
