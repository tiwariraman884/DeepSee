import Link from "next/link";
import { Waves, Shield, Lock, Eye, Server, FileText, Mail } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Privacy Policy",
  description:
    "DeepSea Guardian privacy policy — GDPR compliant. Learn how we collect, use, store, and protect your data when using our AI-powered ocean monitoring platform.",
  path: "/privacy-policy",
});

const sections = [
  { id: "collection", title: "Data We Collect", content: "We collect account information (name, email, organization), platform usage data (dashboards viewed, reports generated), sensor and drone data you upload or connect, and technical data (IP address, browser type, device info) for security and analytics." },
  { id: "usage", title: "How We Use Your Data", content: "We use your data to provide and improve the platform, generate ocean intelligence reports, send service notifications, ensure platform security, and comply with legal obligations. We do not sell your personal data to third parties." },
  { id: "cookies", title: "Cookies", content: "We use essential cookies for authentication and session management, analytics cookies to understand usage patterns, and preference cookies to remember your settings. See our Cookie Policy for details." },
  { id: "sharing", title: "Data Sharing", content: "We share data with trusted service providers (cloud hosting, analytics, support tools) under strict data processing agreements. We may disclose data if required by law or to protect our rights and safety." },
  { id: "retention", title: "Data Retention", content: "Account data is retained until account deletion. Platform usage logs are retained for 90 days. Ocean data and reports are retained according to your organization's data retention policy." },
  { id: "rights", title: "Your Rights", content: "Under GDPR and similar regulations, you have the right to access, correct, delete, and export your data. You can object to processing, restrict processing, and withdraw consent at any time." },
  { id: "children", title: "Children's Privacy", content: "DeepSea Guardian is not intended for users under 16. We do not knowingly collect data from children. If you believe a child has provided us with personal data, contact us immediately." },
  { id: "transfers", title: "International Transfers", content: "Data may be processed in countries outside your own. We ensure adequate safeguards through Standard Contractual Clauses and other legal mechanisms approved by the EU Commission." },
  { id: "contact", title: "Contact Us", content: "For privacy inquiries, data requests, or complaints, contact our Data Protection Officer at privacy@deepseaguardian.org or via our contact page." },
];

export default function PrivacyPolicyPage() {
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
            <Lock className="h-3.5 w-3.5" /> Privacy Policy
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Your{" "}
            <span className="gradient-text">privacy</span> matters
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ocean-200/70">
            Last updated: July 2026. This policy explains how DeepSea Guardian collects, uses, and protects your personal data.
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
