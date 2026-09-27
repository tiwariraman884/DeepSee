import Link from "next/link";
import { Waves, Users, Award, Globe2, ArrowRight } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Team",
  description:
    "Meet the DeepSea Guardian team — marine scientists, AI engineers, oceanographers, and environmental analysts working together to protect our oceans.",
  path: "/team",
});

const leadership = [
  {
    name: "Dr. Elena Vasquez",
    role: "Founder & CEO",
    bio: "Marine biologist with 15+ years in ocean conservation. Former lead researcher at NOAA&apos;s Pacific Marine Environmental Laboratory.",
    initials: "EV",
  },
  {
    name: "James Chen",
    role: "Chief Technology Officer",
    bio: "AI/ML engineer formerly at NASA JPL. Led computer vision systems for satellite-based Earth observation.",
    initials: "JC",
  },
  {
    name: "Dr. Amara Okafor",
    role: "Head of Marine Science",
    bio: "Oceanographer and coral reef specialist. PhD from University of Cape Town. 20+ peer-reviewed publications.",
    initials: "AO",
  },
  {
    name: "Sarah Lindström",
    role: "VP of Product",
    bio: "Former product leader at Spotify and Klarna. Expert in SaaS platforms for scientific research and data visualization.",
    initials: "SL",
  },
];

const team = [
  { name: "Dr. Marcus Webb", role: "Lead AI Engineer", bio: "Deep learning for environmental monitoring. Stanford CS PhD." },
  { name: "Dr. Priya Sharma", role: "Marine Data Scientist", bio: "Statistical modeling of ocean ecosystems. Former WHOI researcher." },
  { name: "Tomás Rivera", role: "GIS Engineer", bio: "Spatial analytics and mapping. Expert in CartoDB and Mapbox." },
  { name: "Aisha Johnson", role: "Frontend Lead", bio: "React/Next.js specialist. Built data viz platforms for Bloomberg and The New York Times." },
  { name: "David Kim", role: "Backend Engineer", bio: "Scalable data pipelines. Former AWS engineer." },
  { name: "Dr. Lena Hoffmann", role: "Environmental Analyst", bio: "Climate policy and environmental impact assessment. UNEP consultant." },
  { name: "Raj Patel", role: "Drone Systems Engineer", bio: "Autonomous vehicle systems. Former SpaceX engineer." },
  { name: "Dr. Mei Zhang", role: "Research Scientist", bio: "Marine biodiversity and species classification using computer vision." },
];

const advisors = [
  { name: "Prof. Carl Sagan Jr.", org: "Stanford University", area: "Earth Systems Science" },
  { name: "Dr. Maria Santos", org: "NOAA", area: "Ocean Acidification" },
  { name: "Dr. James Okonkwo", org: "WWF", area: "Marine Policy" },
  { name: "Prof. Anna Kowalski", org: "MIT", area: "AI for Climate" },
];

const partners = [
  "NOAA — National Oceanic and Atmospheric Administration",
  "UNEP — United Nations Environment Programme",
  "WWF — World Wildlife Fund",
  "IUCN — International Union for Conservation of Nature",
  "UNESCO — Intergovernmental Oceanographic Commission",
  "MIT — Massachusetts Institute of Technology",
  "Stanford University — Hopkins Marine Station",
  "University of Cape Town — Marine Research Institute",
];

export default function TeamPage() {
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
          <Link href="/careers" className="rounded-xl bg-ocean-500 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-400">
            Join Us
          </Link>
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Users className="h-3.5 w-3.5" /> Our Team
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Scientists, engineers, and{" "}
            <span className="gradient-text">ocean advocates</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            We are a multidisciplinary team of marine biologists, AI researchers, engineers, and environmental policy experts united by a single purpose: protecting the ocean.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white">Leadership</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {leadership.map((p) => (
              <div key={p.name} className="glass rounded-2xl p-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ocean-500/20 text-xl font-bold text-ocean-300">
                  {p.initials}
                </div>
                <h3 className="mt-4 font-semibold text-white">{p.name}</h3>
                <p className="text-xs text-ocean-300">{p.role}</p>
                <p className="mt-2 text-sm text-ocean-200/60">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white">Core Team</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((p) => (
              <div key={p.name} className="glass rounded-2xl p-6">
                <h3 className="font-semibold text-white">{p.name}</h3>
                <p className="text-xs text-ocean-300">{p.role}</p>
                <p className="mt-2 text-sm text-ocean-200/60">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white">Advisory Board</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {advisors.map((a) => (
              <div key={a.name} className="glass rounded-2xl p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-biolum-500/15 text-biolum-400">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-white">{a.name}</h3>
                <p className="text-xs text-ocean-300">{a.org}</p>
                <p className="text-xs text-ocean-200/60">{a.area}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Partner Organizations</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ocean-200/70">
            DeepSea Guardian collaborates with leading institutions and organizations worldwide.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {partners.map((p) => (
              <div key={p} className="glass rounded-xl p-4 text-center text-sm text-ocean-200/70">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Join the team</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            We&apos;re always looking for passionate individuals to join our mission.
          </p>
          <Link href="/careers" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
            View Open Positions <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
