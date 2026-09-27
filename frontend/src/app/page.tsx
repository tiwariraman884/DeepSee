"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Waves,
  Shield,
  Map,
  Brain,
  Bot,
  Radio,
  Fish,
  AlertTriangle,
  ArrowRight,
  Globe2,
  Activity,
  FileBarChart,
  Leaf,
  TrendingDown,
  Github,
  Linkedin,
  Twitter,
  Youtube,
  Mail,
  Lock,
  ShieldCheck,
  Globe,
  Zap,
} from "lucide-react";
import { CountUp } from "@/components/visuals/CountUp";
import { Carousel } from "@/components/shared/Carousel";
import { Navbar } from "@/components/layout/Navbar";
import { LazyVideo } from "@/components/shared/LazyVideo";

const features = [
  { icon: Activity, title: "Ocean Monitoring Dashboard", desc: "Real-time ocean health score, active drones, hotspots, species, sensors." },
  { icon: Map, title: "Interactive Ocean Map", desc: "Pollution heatmaps, sensor locations, drone tracking and risk zones." },
  { icon: AlertTriangle, title: "AI Pollution Detection", desc: "Plastics, oil spills, ghost nets and illegal dumping — detected early." },
  { icon: Fish, title: "Biodiversity Monitoring", desc: "Species tracking, population trends, habitat mapping and threat assessment." },
  { icon: Brain, title: "AI Risk Prediction", desc: "Forecast coral bleaching, biodiversity loss and pollution expansion." },
  { icon: Radio, title: "Drone Command Center", desc: "Live drone tracking, battery monitoring and mission visualization." },
  { icon: Shield, title: "Alerts & Notifications", desc: "Critical, warning and informational alerts across all monitored zones." },
  { icon: FileBarChart, title: "Reports & Analytics", desc: "Weekly, environmental, ocean health and species reports." },
  { icon: Bot, title: "AI Assistant", desc: "Natural-language answers about pollution, species and ocean health." },
];

const innovations = [
  { icon: Globe2, title: "Digital Twin Ocean", desc: "3D representation for visualization, monitoring and future simulation." },
  { icon: Activity, title: "Time Machine", desc: "Visualize changes over Today / 1M / 6M / 1Y / 5Y horizons." },
  { icon: AlertTriangle, title: "Emergency Response", desc: "AI-generated alerts for illegal dumping, bleaching and thresholds." },
  { icon: Waves, title: "Ocean Health Index", desc: "Unified score from pollution, biodiversity, water quality and coral." },
  { icon: Leaf, title: "Conservation Meter", desc: "Measures environmental recovery progress over time." },
];

const stats = [
  { value: 72, label: "Ocean Health Index", suffix: "" },
  { value: 6, label: "Active Drones", suffix: "" },
  { value: 8, label: "Pollution Hotspots", suffix: "" },
  { value: 10, label: "Species Tracked", suffix: "" },
];

const partners = ["UNEP", "UNESCO", "WWF", "NOAA", "IUCN"];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://deepsea-guardian.example.org/#organization",
        name: "DeepSea Guardian",
        url: "https://deepsea-guardian.example.org",
        description:
          "An AI-powered mission control platform that monitors, predicts, and protects deep-sea ecosystems through intelligent environmental analytics.",
        logo: "https://deepsea-guardian.example.org/opengraph-image",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": "https://deepsea-guardian.example.org/#website",
        url: "https://deepsea-guardian.example.org",
        name: "DeepSea Guardian",
        description:
          "AI-powered ocean monitoring, prediction and conservation platform.",
        inLanguage: "en",
        publisher: {
          "@id": "https://deepsea-guardian.example.org/#organization",
        },
      },
    ],
  };

  return (
    <div className="overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main id="main-content">
      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
                <Shield className="h-3.5 w-3.5" /> AI-Powered Ocean Intelligence
              </span>
              <h1 className="mt-6 text-5xl font-bold leading-tight text-white sm:text-6xl">
                Protecting the Ocean with{" "}
                <span className="gradient-text">Artificial Intelligence</span>
              </h1>
              <div className="mt-6 flex items-center justify-center gap-2 text-lg text-ocean-200/70 lg:justify-start">
                <TrendingDown className="h-5 w-5 text-biolum-400" />
                <span>
                  Atmospheric CO₂ equivalent reduced:{" "}
                  <span className="font-bold text-biolum-400">
                    <CountUp end={12480} suffix=" t" />
                  </span>
                </span>
              </div>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-ocean-200/70 lg:mx-0">
                A mission control platform that monitors, predicts, and protects
                deep-sea ecosystems through intelligent environmental analytics and
                real-time ocean intelligence.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400"
                >
                  Enter Mission Control <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 rounded-xl border border-ocean-500/30 px-6 py-3 text-sm font-semibold text-ocean-100 hover:bg-ocean-500/10"
                >
                  Explore Ocean Map
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="relative mx-auto w-full max-w-[580px] lg:mx-0"
            >
              <div className="relative overflow-hidden rounded-3xl">
                <LazyVideo
                  src="/videos/hero.webm"
                  className="aspect-[4/3] w-full"
                  overlayClassName="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"
                  ariaLabel="Ocean cleanup animation"
                  priority={true}
                />
              </div>
            </motion.div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="glass rounded-2xl p-5"
              >
                <p className="text-3xl font-bold tabular-nums text-biolum-400">
                  <CountUp end={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-xs text-ocean-200/60">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative px-6 py-20">
        <div className="absolute inset-0 z-0 opacity-[0.07]">
          <LazyVideo
            src="/videos/features.webm"
            className="h-full w-full"
            ariaLabel="Subtle ocean particles"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Core Features</h2>
            <p className="mt-3 text-ocean-200/60">
              A complete platform for ocean observation, analysis and response.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="glass rounded-2xl p-6 transition-colors hover:border-ocean-400/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="innovation" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Innovation Features</h2>
            <p className="mt-3 text-ocean-200/60">
              Cutting-edge capabilities that set DeepSea Guardian apart.
            </p>
          </div>
          <Carousel
            className="mx-auto max-w-3xl"
            slides={innovations.map((f) => ({
              id: f.title,
              content: (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="relative aspect-video w-full overflow-hidden">
                    <LazyVideo
                      src="/videos/features.webm"
                      className="h-full w-full"
                      overlayClassName="absolute inset-0 bg-gradient-to-t from-secondary/60 to-transparent"
                      ariaLabel={`${f.title} animation`}
                    />
                  </div>
                  <div className="p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-biolum-500/15 text-biolum-400">
                      <f.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-white">{f.title}</h3>
                    <p className="mx-auto mt-3 max-w-md text-sm text-ocean-200/60">{f.desc}</p>
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs uppercase tracking-widest text-ocean-200/40">Trusted by global partners</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-60">
            {partners.map((p) => (
              <span key={p} className="text-lg font-bold text-ocean-200/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="impact" className="px-6 py-20">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl glass">
          <div className="absolute inset-0 z-0">
            <LazyVideo
              src="/videos/impact.webm"
              className="h-full w-full"
              overlayClassName="absolute inset-0 bg-secondary/80"
              ariaLabel="Subtle underwater light effect"
            />
          </div>
          <div className="relative z-10 p-10 text-center">
            <h2 className="text-3xl font-bold text-white">Expected Impact</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-lg font-semibold text-biolum-400">Environmental</p>
                <p className="mt-2 text-sm text-ocean-200/60">
                  Early pollution detection, biodiversity protection and better conservation planning.
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ocean-300">Social</p>
                <p className="mt-2 text-sm text-ocean-200/60">
                  Increased awareness and better-informed policy decisions.
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-coral-400">Scientific</p>
                <p className="mt-2 text-sm text-ocean-200/60">
                  A centralized ocean intelligence platform for marine research.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>

      <footer className="border-t border-ocean-500/10 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-500/20 text-ocean-300">
                  <Waves className="h-4 w-4" />
                </div>
                <span className="font-bold text-white">DeepSea Guardian</span>
              </div>
              <p className="mt-3 text-sm text-ocean-200/50">
                Protecting the Ocean with Artificial Intelligence.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <a href="#" aria-label="GitHub" className="text-ocean-200/50 hover:text-ocean-100">
                  <Github className="h-4 w-4" />
                </a>
                <a href="#" aria-label="LinkedIn" className="text-ocean-200/50 hover:text-ocean-100">
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="#" aria-label="X (Twitter)" className="text-ocean-200/50 hover:text-ocean-100">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="#" aria-label="YouTube" className="text-ocean-200/50 hover:text-ocean-100">
                  <Youtube className="h-4 w-4" />
                </a>
                <a href="#" aria-label="Email" className="text-ocean-200/50 hover:text-ocean-100">
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Company</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/about" className="text-sm text-ocean-200/50 hover:text-ocean-100">About DeepSea Guardian</Link></li>
                <li><Link href="/mission" className="text-sm text-ocean-200/50 hover:text-ocean-100">Our Mission</Link></li>
                <li><Link href="/team" className="text-sm text-ocean-200/50 hover:text-ocean-100">Team</Link></li>
                <li><Link href="/careers" className="text-sm text-ocean-200/50 hover:text-ocean-100">Careers</Link></li>
                <li><Link href="/contact" className="text-sm text-ocean-200/50 hover:text-ocean-100">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Resources</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/documentation" className="text-sm text-ocean-200/50 hover:text-ocean-100">Documentation</Link></li>
                <li><Link href="/features" className="text-sm text-ocean-200/50 hover:text-ocean-100">Features</Link></li>
                <li><Link href="/roadmap" className="text-sm text-ocean-200/50 hover:text-ocean-100">Roadmap</Link></li>
                <li><Link href="/blog" className="text-sm text-ocean-200/50 hover:text-ocean-100">Blog</Link></li>
                <li><Link href="/faq" className="text-sm text-ocean-200/50 hover:text-ocean-100">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Legal</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/privacy-policy" className="text-sm text-ocean-200/50 hover:text-ocean-100">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-ocean-200/50 hover:text-ocean-100">Terms of Service</Link></li>
                <li><Link href="/cookie-policy" className="text-sm text-ocean-200/50 hover:text-ocean-100">Cookie Policy</Link></li>
                <li><Link href="/security" className="text-sm text-ocean-200/50 hover:text-ocean-100">Security</Link></li>
                <li><Link href="/accessibility" className="text-sm text-ocean-200/50 hover:text-ocean-100">Accessibility</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Support</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/help-center" className="text-sm text-ocean-200/50 hover:text-ocean-100">Help Center</Link></li>
                <li><Link href="/report-issue" className="text-sm text-ocean-200/50 hover:text-ocean-100">Report an Issue</Link></li>
                <li><Link href="/community" className="text-sm text-ocean-200/50 hover:text-ocean-100">Community</Link></li>
                <li><Link href="/feedback" className="text-sm text-ocean-200/50 hover:text-ocean-100">Feedback</Link></li>
                <li><Link href="/status" className="text-sm text-ocean-200/50 hover:text-ocean-100">Status</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-xs text-ocean-200/60">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ocean-200/60">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Enterprise-grade Security</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ocean-200/60">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sustainability</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ocean-200/60">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>High Performance</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-ocean-500/10 pt-6 sm:flex-row">
            <p className="text-xs text-ocean-200/40">© 2026 DeepSea Guardian. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-ocean-200/40">
              <span>HackOcean PS03 Project</span>
              <Link href="/privacy-policy" className="hover:text-ocean-100">Privacy</Link>
              <Link href="/terms" className="hover:text-ocean-100">Terms</Link>
              <Link href="/cookie-policy" className="hover:text-ocean-100">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
