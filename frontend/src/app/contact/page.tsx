import Link from "next/link";
import { Waves, Mail, Phone, MapPin, Clock, MessageSquare, Send } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Contact",
  description:
    "Get in touch with DeepSea Guardian. Contact us for research partnerships, media requests, technical support, or general inquiries about our AI-powered ocean monitoring platform.",
  path: "/contact",
});

const contacts = [
  { icon: Mail, title: "General Inquiries", email: "hello@deepseaguardian.org", desc: "For partnership opportunities, product questions, or general information." },
  { icon: MessageSquare, title: "Research Partnerships", email: "research@deepseaguardian.org", desc: "For academic collaborations, data sharing, and joint research initiatives." },
  { icon: Phone, title: "Media Requests", email: "press@deepseaguardian.org", desc: "For interviews, press kits, and media-related inquiries." },
  { icon: Send, title: "Technical Support", email: "support@deepseaguardian.org", desc: "For platform support, API questions, and technical documentation." },
];

const offices = [
  { city: "San Francisco", country: "USA", address: "1 Market Street, Suite 2000, San Francisco, CA 94105" },
  { city: "Lisbon", country: "Portugal", address: "Avenida da Liberdade 110, 1250-146 Lisboa, Portugal" },
  { city: "Singapore", country: "Singapore", address: "1 Marina Boulevard, Level 28, Singapore 018989" },
];

export default function ContactPage() {
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
            <Mail className="h-3.5 w-3.5" /> Contact Us
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Get in{" "}
            <span className="gradient-text">touch</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Whether you&apos;re a researcher, policymaker, journalist, or conservationist — we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {contacts.map((c) => (
              <div key={c.title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <a href={`mailto:${c.email}`} className="text-sm text-ocean-300 hover:text-ocean-100">{c.email}</a>
                  </div>
                </div>
                <p className="mt-3 text-sm text-ocean-200/60">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white">Global Offices</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {offices.map((o) => (
              <div key={o.city} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ocean-300" />
                  <h3 className="font-semibold text-white">{o.city}, {o.country}</h3>
                </div>
                <p className="mt-2 text-sm text-ocean-200/60">{o.address}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-white">Send us a message</h2>
          <form className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="text-xs text-ocean-200/60">Full Name</label>
              <input id="name" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
            </div>
            <div>
              <label htmlFor="email" className="text-xs text-ocean-200/60">Email</label>
              <input id="email" type="email" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="subject" className="text-xs text-ocean-200/60">Subject</label>
              <select id="subject" className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400">
                <option>General Inquiry</option>
                <option>Research Partnership</option>
                <option>Media Request</option>
                <option>Technical Support</option>
                <option>Business Collaboration</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="message" className="text-xs text-ocean-200/60">Message</label>
              <textarea id="message" rows={5} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
                Send Message <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <div className="flex items-center justify-center gap-2 text-ocean-300">
            <Clock className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-white">Office Hours</h2>
          </div>
          <p className="mt-3 text-ocean-200/70">Monday – Friday, 09:00 – 18:00 CET</p>
          <p className="mt-1 text-sm text-ocean-200/60">We aim to respond to all inquiries within 2 business days.</p>
        </div>
      </section>
    </main>
  );
}
