import Link from "next/link";
import { Waves, Shield, Lock, Eye, Server, Mail, AlertTriangle } from "lucide-react";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Security",
  description:
    "DeepSea Guardian security — enterprise-grade encryption, HTTPS, authentication, RBAC, cloud security, incident response, and responsible disclosure program.",
  path: "/security",
});

const pillars = [
  { icon: Lock, title: "Encryption", desc: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256. Database connections use encrypted tunnels. API keys are hashed and never exposed." },
  { icon: Eye, title: "Authentication", desc: "Multi-factor authentication (MFA), SSO via SAML 2.0 and OAuth 2.0, and session management with automatic timeout. Password policies enforce complexity and rotation." },
  { icon: Shield, title: "RBAC", desc: "Role-Based Access Control with granular permissions: Viewer, Analyst, Researcher, Admin, and Super Admin. All access is logged and auditable." },
  { icon: Server, title: "Infrastructure", desc: "Hosted on SOC 2 Type II certified cloud infrastructure. Automated backups, DDoS protection, and 99.9% uptime SLA with geo-redundant failover." },
  { icon: AlertTriangle, title: "Incident Response", desc: "24/7 security monitoring with automated threat detection. Incident response team available within 15 minutes. Post-incident reviews and transparent communication." },
  { icon: Mail, title: "Responsible Disclosure", desc: "We welcome security research. Report vulnerabilities to security@deepseaguardian.org. We commit to acknowledging reports within 48 hours and providing updates throughout remediation." },
];

export default function SecurityPage() {
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
            <Shield className="h-3.5 w-3.5" /> Security
          </span>
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            Enterprise-grade{" "}
            <span className="gradient-text">security</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ocean-200/70">
            Protecting ocean data with the same security standards used by financial institutions and government agencies.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.title} className="glass rounded-2xl p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-500/15 text-ocean-300">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-ocean-200/60">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Report a Security Issue</h2>
          <p className="mx-auto mt-3 max-w-xl text-ocean-200/70">
            Found a vulnerability? We take security seriously. Please report it responsibly.
          </p>
          <a href="mailto:security@deepseaguardian.org" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ocean-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ocean-400">
            <Mail className="h-4 w-4" /> security@deepseaguardian.org
          </a>
        </div>
      </section>
    </main>
  );
}
