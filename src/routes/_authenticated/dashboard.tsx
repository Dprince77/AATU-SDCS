import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Files, Gavel, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STATUS_LABELS, STATUS_TONE, SEVERITY_TONE } from "@/lib/case-meta";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — AATU Disciplinary Committee" },
      { name: "description", content: "Student Disciplinary Dashboard: recent cases, upcoming hearings, and key activity at a glance." },
      { property: "og:title", content: "Dashboard — AATU Disciplinary Committee" },
      { property: "og:description", content: "Student Disciplinary Dashboard: recent cases, upcoming hearings, and key activity at a glance." },
      { property: "og:url", content: `${process.env.PUBLIC_APP_URL ?? ""}/dashboard` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${process.env.PUBLIC_APP_URL ?? ""}/dashboard` }],
  }),
});

function Dashboard() {
  const { profile, isStaff, hasRole } = useAuth();

  const { data: cases = [] } = useQuery({
    queryKey: ["cases", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hearings = [] } = useQuery({
    queryKey: ["hearings", "upcoming"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hearings")
        .select("*, cases(case_number, student_name, title)")
        .gte("scheduled_at", new Date().toISOString())
        .eq("status", "scheduled")
        .order("scheduled_at")
        .limit(5);
      return data ?? [];
    },
  });

  const open = cases.filter((c) => !["closed", "decided"].includes(c.status)).length;
  const decided = cases.filter((c) => c.status === "decided" || c.status === "closed").length;
  const high = cases.filter((c) => c.severity === "high" || c.severity === "critical").length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Student Disciplinary Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {profile?.full_name?.split(" ")[0] ?? "there"}.</p>
          <p className="text-muted-foreground mt-1">
            {isStaff ? "Disciplinary Committee dashboard — latest activity at a glance." : "Your disciplinary case overview."}
          </p>
        </div>
        {(hasRole("faculty") || isStaff) && (
          <Button asChild><Link to="/cases/new"><Plus /> Report incident</Link></Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Files} label="Recent cases" value={cases.length} tone="primary" />
        <StatCard icon={AlertTriangle} label="Open" value={open} tone="warning" />
        <StatCard icon={Gavel} label="Upcoming hearings" value={hearings.length} tone="chart" />
        <StatCard icon={CheckCircle2} label="Decided / closed" value={decided} tone="success" subtitle={`${high} flagged high`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="font-display">Recent cases</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/cases">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {cases.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No cases yet.</p>}
            {cases.map((c) => (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="block">
                <div className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{c.case_number}</span>
                      <Badge variant="outline" className={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                      <Badge variant="outline" className={SEVERITY_TONE[c.severity]}>{c.severity}</Badge>
                    </div>
                    <p className="font-medium truncate mt-0.5">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.student_name} · {c.student_matric}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Upcoming hearings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {hearings.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No scheduled hearings.</p>}
            {hearings.map((h: any) => (
              <Link key={h.id} to="/cases/$caseId" params={{ caseId: h.case_id }} className="block p-3 rounded-md border hover:bg-accent/30">
                <p className="text-xs font-mono text-muted-foreground">{h.cases?.case_number}</p>
                <p className="font-medium text-sm mt-0.5 truncate">{h.cases?.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(h.scheduled_at).toLocaleString()}</p>
                {h.location && <p className="text-xs text-muted-foreground">📍 {h.location}</p>}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle, tone }: { icon: any; label: string; value: number; subtitle?: string; tone: "primary" | "warning" | "success" | "chart" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/15 text-success-foreground",
    chart: "bg-chart-1/15 text-chart-1",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`size-11 rounded-lg grid place-items-center ${toneMap[tone]}`}><Icon className="size-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="font-display text-3xl font-semibold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
