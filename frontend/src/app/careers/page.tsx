import Link from "next/link";
import { Waves, Briefcase, Heart, Globe, ArrowRight, Code, Brain, Map, Palette, FlaskConical } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Careers",
  description:
    "Join DeepSea Guardian and help protect the oceans with AI. Explore open positions in engineering, marine science, design, and research.",
  path: "/careers",
});

const positions = [
  {
    title: "Frontend Developer",
    department: "Engineering",
    location: "Remote / Hybrid",
    type: "Full-time",
    icon: Code,
    description: "Build intuitive, high-performance data visualization interfaces for marine scientists and policymakers.",
  },
  {
    title: "AI Engineer",
    department: "Research",
    location: "Remote / Hybrid",
    type: "Full-time",
    icon: Brain,
    description: "Develop and deploy deep learning models for pollution detection, species classification, and environmental forecasting.",
  },
  {
    title: "Marine Data Scientist",
    department: "Science",
    location: "Remote",
    type: "Full-time",
    icon: FlaskConical,
    description: "Analyze oceanographic datasets, develop statistical models, and translate scientific findings into platform features.",
  },
  {
    title: "GIS Engineer",
    department: "Engineering",
    location: "Remote / Hybrid",
    type: "Full-time",
    icon: Map,
    description: "Design geospatial data pipelines, interactive maps, and satellite imagery processing workflows.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote / Hybrid",
    type: "Full-time",
    icon: Palette,
    description: "Craft elegant, accessible interfaces for complex scientific data. Experience with design systems and data visualization required.",
  },
  {
    title: "Research Intern",
    department: "Science",
    location: "Remote",
    type: "Internship",
    icon: FlaskConical,
    description: "Work alongside marine scientists and AI researchers. Ideal for graduate students in oceanography, ecology, or computer science.",
  },
];

const benefits = [
  { title: "Competitive Salary", desc: "Above-market compensation aligned with mission-driven organizations." },
  { title: "Remote-First", desc: "Work from anywhere. Flexible hours with core collaboration windows." },
  { title: "Health Coverage", desc: "Comprehensive medical, dental, and vision insurance for you and your family." },
  { title: "Learning Budget", desc: "Annual stipend for courses, conferences, books, and professional development." },
  { title: "Impact Days", desc: "40 hours per year dedicated to environmental volunteering or research." },
  { title: "Equipment", desc: "Top-tier laptop, monitors, and home office setup provided." },
];

export default function CareersPage() {
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
        </div>
      </header>

      <section className="relative px-6 pb-20 pt-36">
        <div className="absolute inset-0 bg-radial-glow" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <Briefcase className="h-3.5 w-3.5" /> Careers
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Build the future of{" "}
            <span className="gradient-text">ocean conservation</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Join a team of scientists, engineers, and advocates using AI to protect the world&apos;s oceans.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Open Positions</h2>
          <div className="mt-12 grid gap-6">
            {positions.map((job) => (
              <div key={job.title} className="glass rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <job.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                      <span className="rounded-full border border-ocean-500/20 bg-ocean-500/10 px-3 py-1 text-xs text-ocean-200">{job.department}</span>
                      <span className="rounded-full border border-ocean-500/20 bg-ocean-500/10 px-3 py-1 text-xs text-ocean-200">{job.type}</span>
                      <span className="rounded-full border border-ocean-500/20 bg-ocean-500/10 px-3 py-1 text-xs text-ocean-200">{job.location}</span>
                    </div>
                    <p className="mt-2 text-sm text-ocean-200/70">{job.description}</p>
                    <Link href="#" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ocean-300 hover:text-ocean-100">
                      Apply Now <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Benefits & Perks</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="glass rounded-2xl p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-biolum-500/15 text-biolum-400">
                  <Heart className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-white">{b.title}</h3>
                <p className="mt-1 text-sm text-ocean-200/60">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Application Process</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ocean-500/20 text-ocean-300 font-bold">1</div>
              <h3 className="mt-3 font-semibold text-white">Submit Application</h3>
              <p className="mt-1 text-sm text-ocean-200/60">Upload your resume and tell us why you want to join.</p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ocean-500/20 text-ocean-300 font-bold">2</div>
              <h3 className="mt-3 font-semibold text-white">Interview</h3>
              <p className="mt-1 text-sm text-ocean-200/60">Technical and cultural fit conversations with the team.</p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ocean-500/20 text-ocean-300 font-bold">3</div>
              <h3 className="mt-3 font-semibold text-white">Offer & Onboarding</h3>
              <p className="mt-1 text-sm text-ocean-200/60">Receive an offer and join the mission within weeks.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
