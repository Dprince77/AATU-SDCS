import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STATUS_LABELS, STATUS_TONE, SEVERITY_TONE } from "@/lib/case-meta";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/cases/")({
  ssr: false,
  component: CasesList,
});

function CasesList() {
  const { isStaff, hasRole } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases", "list", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = cases.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.case_number.toLowerCase().includes(s) ||
      c.title.toLowerCase().includes(s) ||
      c.student_name.toLowerCase().includes(s) ||
      (c.student_matric ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Cases</h1>
          <p className="text-muted-foreground mt-1">All disciplinary cases in the system.</p>
        </div>
        {(hasRole("faculty") || isStaff) && (
          <Button asChild><Link to="/cases/new"><Plus /> Report incident</Link></Button>
        )}
      </div>

      <Card className="p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by case #, title, student name, matric…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Case #</th>
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Severity</th>
                <th className="p-3 font-medium">Filed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No cases found.</td></tr>}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/20 cursor-pointer">
                  <td className="p-3 font-mono text-xs">
                    <Link to="/cases/$caseId" params={{ caseId: c.id }} className="text-primary hover:underline">{c.case_number}</Link>
                  </td>
                  <td className="p-3"><Link to="/cases/$caseId" params={{ caseId: c.id }} className="font-medium hover:underline">{c.title}</Link><div className="text-xs text-muted-foreground">{c.offense_category}</div></td>
                  <td className="p-3"><div>{c.student_name}</div><div className="text-xs text-muted-foreground font-mono">{c.student_matric}</div></td>
                  <td className="p-3"><Badge variant="outline" className={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Badge></td>
                  <td className="p-3"><Badge variant="outline" className={SEVERITY_TONE[c.severity]}>{c.severity}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + cases.length} cases
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={cases.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
