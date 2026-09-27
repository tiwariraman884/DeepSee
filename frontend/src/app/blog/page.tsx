import Link from "next/link";
import { Waves, ArrowRight, Clock, User } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Blog",
  description:
    "Insights, research updates, and stories from the DeepSea Guardian team. Exploring ocean conservation, AI, marine science, and environmental technology.",
  path: "/blog",
});

const posts = [
  {
    slug: "ai-detecting-ocean-pollution",
    title: "How AI is Revolutionizing Ocean Pollution Detection",
    excerpt: "From satellite imagery to drone footage, computer vision models are identifying pollution hotspots in near real-time. Here's how DeepSea Guardian processes 10TB of imagery daily.",
    date: "2026-07-15",
    readTime: "8 min",
    author: "Dr. Elena Vasquez",
    tags: ["AI", "Pollution", "Satellite"],
  },
  {
    slug: "coral-bleaching-prediction",
    title: "Predicting Coral Bleaching Events 5 Years in Advance",
    excerpt: "Our new deep learning model combines sea surface temperature, ocean acidification, and current stress data to forecast bleaching risk with 87% accuracy.",
    date: "2026-07-08",
    readTime: "12 min",
    author: "Dr. Amara Okafor",
    tags: ["Coral", "Climate", "AI"],
  },
  {
    slug: "drone-swarm-mapping",
    title: "Autonomous Drone Swarms: The Future of Marine Mapping",
    excerpt: "Coordinated fleets of underwater and surface drones can map 1,000 km² of ocean in a single mission. Here's how we're building swarm intelligence for conservation.",
    date: "2026-06-28",
    readTime: "10 min",
    author: "Raj Patel",
    tags: ["Drones", "Mapping", "Technology"],
  },
  {
    slug: "biodiversity-monitoring-computer-vision",
    title: "Computer Vision for Marine Biodiversity: A Breakthrough",
    excerpt: "Identifying 500+ marine species from underwater imagery with 94% accuracy. DeepSea Guardian's vision models are transforming how we monitor ocean life.",
    date: "2026-06-15",
    readTime: "7 min",
    author: "Dr. Mei Zhang",
    tags: ["Biodiversity", "Computer Vision", "Species"],
  },
  {
    slug: "illegal-fishing-detection",
    title: "Fighting Illegal Fishing with Satellite AIS Data",
    excerpt: "How combining AIS signals, satellite imagery, and machine learning helps authorities identify and intercept illegal fishing vessels in real time.",
    date: "2026-06-02",
    readTime: "9 min",
    author: "Dr. Marcus Webb",
    tags: ["Fishing", "Satellite", "Policy"],
  },
  {
    slug: "ocean-health-index-2026",
    title: "Global Ocean Health Index: 2026 Mid-Year Report",
    excerpt: "Our analysis of 12,000+ data points reveals concerning trends in Pacific gyre pollution and encouraging recovery in marine protected areas.",
    date: "2026-05-20",
    readTime: "15 min",
    author: "Dr. Lena Hoffmann",
    tags: ["Report", "Ocean Health", "Research"],
  },
  {
    slug: "digital-twin-ocean",
    title: "Building a Digital Twin of the Ocean",
    excerpt: "3D simulation models allow conservationists to test interventions before deploying resources. Here's how we're building the world's first Digital Twin Ocean.",
    date: "2026-05-05",
    readTime: "11 min",
    author: "James Chen",
    tags: ["Digital Twin", "Simulation", "Technology"],
  },
  {
    slug: "sustainable-development-goals",
    title: "How DeepSea Guardian Advances the UN Sustainable Development Goals",
    excerpt: "From SDG 14 (Life Below Water) to SDG 13 (Climate Action), our platform directly contributes to measurable progress toward the 2030 Agenda.",
    date: "2026-04-22",
    readTime: "6 min",
    author: "Sarah Lindström",
    tags: ["SDG", "UN", "Impact"],
  },
];

export default function BlogPage() {
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
            Blog
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Insights from the{" "}
            <span className="gradient-text">deep blue</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Research updates, technical deep-dives, and stories from the frontlines of ocean conservation.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.slug} className="glass rounded-2xl overflow-hidden">
                <div className="aspect-video w-full bg-abyss-900/60" />
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-ocean-200/60">
                    <span>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readTime}</span>
                  </div>
                  <h2 className="mt-3 font-semibold text-white leading-snug">{post.title}</h2>
                  <p className="mt-2 text-sm text-ocean-200/60 line-clamp-2">{post.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-ocean-200/60 flex items-center gap-1"><User className="h-3 w-3" /> {post.author}</span>
                    <Link href={`/blog/${post.slug}`} className="text-sm font-medium text-ocean-300 hover:text-ocean-100">Read more</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
