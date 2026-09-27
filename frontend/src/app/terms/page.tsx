import Link from "next/link";
import { Waves, FileText, Shield, Mail } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Terms of Service",
  description:
    "DeepSea Guardian terms of service — eligibility, acceptable use, accounts, user responsibilities, restrictions, intellectual property, liability, termination, and governing law.",
  path: "/terms",
});

const sections = [
  { id: "eligibility", title: "Eligibility", content: "You must be at least 16 years old and capable of forming a binding contract to use DeepSea Guardian. By using the platform, you represent that you meet these requirements." },
  { id: "acceptance", title: "Acceptance of Terms", content: "By accessing or using DeepSea Guardian, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, please do not use the platform." },
  { id: "accounts", title: "Accounts", content: "You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of any unauthorized access." },
  { id: "use", title: "Acceptable Use", content: "You may use DeepSea Guardian for lawful ocean monitoring, research, and conservation purposes only. Prohibited uses include unauthorized data scraping, reverse engineering, and any activity that harms the platform or its users." },
  { id: "restrictions", title: "Restrictions", content: "You may not copy, modify, distribute, or create derivative works from the platform without explicit permission. You may not use the platform for military, surveillance, or commercial fishing purposes." },
  { id: "ip", title: "Intellectual Property", content: "All content, trademarks, and technology underlying DeepSea Guardian are owned by DeepSea Guardian or its licensors. User data remains your property; you grant us a license to process it for platform functionality." },
  { id: "liability", title: "Limitation of Liability", content: "DeepSea Guardian is provided 'as is' without warranties. We are not liable for indirect, incidental, or consequential damages arising from use of the platform, including data inaccuracies or service interruptions." },
  { id: "termination", title: "Termination", content: "We may suspend or terminate your access for violations of these terms. Upon termination, your right to use the platform ceases immediately. Data retention policies apply as described in our Privacy Policy." },
  { id: "jurisdiction", title: "Governing Law", content: "These terms are governed by the laws of the State of California, United States. Disputes shall be resolved in the courts of San Francisco County, California." },
];

export default function TermsPage() {
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
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-4 py-1.5 text-xs font-medium text-ocean-200">
            <FileText className="h-3.5 w-3.5" /> Terms of Service
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Terms of{" "}
            <span className="gradient-text">Service</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ocean-200/70">
            Last updated: July 2026. Please read these terms carefully before using DeepSea Guardian.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          {sections.map((s) => (
            <div key={s.id} id={s.id} className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white">{s.title}</h2>
              <p className="mt-2 text-sm text-ocean-200/70 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
