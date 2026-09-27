import Link from "next/link";
import { Waves, Users, MessageCircle, Github, Linkedin, Twitter, Youtube, Mail } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Community",
  description:
    "Join the DeepSea Guardian community — connect with marine researchers, data scientists, and ocean conservationists. Share ideas, collaborate, and advance ocean intelligence together.",
  path: "/community",
});

const channels = [
  { icon: MessageCircle, title: "Discord", desc: "Real-time chat with researchers and developers. Ask questions, share data, and collaborate on projects.", href: "#" },
  { icon: Github, title: "GitHub", desc: "Open-source tools, datasets, and contributions. Join our developer community and help build ocean tech.", href: "#" },
  { icon: Linkedin, title: "LinkedIn", desc: "Professional network for ocean scientists and conservationists. Follow for updates and job opportunities.", href: "#" },
  { icon: Twitter, title: "X (Twitter)", desc: "Latest news, research highlights, and ocean conservation stories. Follow @DeepSeaGuardian.", href: "#" },
  { icon: Youtube, title: "YouTube", desc: "Tutorials, webinars, and ocean documentaries. Learn how to use DeepSea Guardian and explore marine science.", href: "#" },
  { icon: Mail, title: "Newsletter", desc: "Weekly digest of ocean research, platform updates, and conservation news. Delivered every Monday.", href: "#" },
];

export default function CommunityPage() {
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
            <Users className="h-3.5 w-3.5" /> Community
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Connect with{" "}
            <span className="gradient-text">ocean advocates</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Join a global network of marine scientists, researchers, developers, and conservationists using DeepSea Guardian to protect our oceans.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((ch) => (
              <a key={ch.title} href={ch.href} className="glass rounded-2xl p-6 transition-colors hover:border-ocean-400/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                  <ch.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{ch.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{ch.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
