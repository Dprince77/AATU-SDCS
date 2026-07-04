import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ShieldCheck, FileText, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/aatu-logo.webp.asset.json";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
  head: () => ({
    meta: [
      { title: "AATU Disciplinary Committee — Case Management" },
      { name: "description", content: "Modern case management for AATU student discipline: intake incidents, manage evidence, schedule hearings, and record sanctions in one auditable workspace." },
      { property: "og:title", content: "AATU Disciplinary Committee — Case Management" },
      { property: "og:description", content: "Modern case management for AATU student discipline: intake incidents, manage evidence, schedule hearings, and record sanctions in one auditable workspace." },
      { property: "og:url", content: `${process.env.PUBLIC_APP_URL ?? ""}/` },
    ],
    links: [{ rel: "canonical", href: `${process.env.PUBLIC_APP_URL ?? ""}/` }],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen" />;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4 gap-4">
          <Link to="/" className="flex items-center gap-4">
            <div className="aatu-crest-ring">
              <img src={logoAsset.url} alt="AATU Logo" className="h-16 w-16 rounded-full bg-card object-contain p-1" />
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-lg md:text-xl text-primary">Abiola Ajimobi Technical University</p>
              <p className="text-xs md:text-sm text-muted-foreground">Student Disciplinary Case Management</p>
            </div>
          </Link>
          <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-xs text-primary mb-6">
              <ShieldCheck className="size-3.5" /> Office of the Dean of Student Affairs · AATU
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-primary">
              Modern case management for student discipline.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Intake incidents, manage evidence, schedule hearings, record sanctions, and track student history — all in one transparent, auditable workspace built for AATU.
            </p>
            <div className="mt-8 flex gap-3">
              <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/auth">Staff sign in</Link></Button>
            </div>
          </div>
          <div className="mt-20 grid md:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "Case Intake", desc: "Faculty, lecturers, HODs and Deans file structured incident reports with auto-generated case numbers." },
              { icon: Gavel, title: "Hearings & Decisions", desc: "Schedule hearings, record outcomes, and issue sanctions with full audit history." },
              { icon: ShieldCheck, title: "Role-Based Access", desc: "Strict permissions for Admin, DSA, Dean, HOD, Lecturers, Disciplinary Committee, and students." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border bg-card/80 backdrop-blur p-6 shadow-sm">
                <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center mb-4">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-display font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t bg-card/60 py-6">
        <div className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground flex items-center justify-between">
          <span>© Abiola Ajimobi Technical University</span>
          <span>Knowledge · Integrity · Service</span>
        </div>
      </footer>
    </div>
  );
}
