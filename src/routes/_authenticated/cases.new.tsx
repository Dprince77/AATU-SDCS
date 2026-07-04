import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OFFENSE_CATEGORIES } from "@/lib/case-meta";
import { MATRIC_HELP, MATRIC_PLACEHOLDER, formatMatricInput, isValidMatric } from "@/lib/matric";
import { useServerFn } from "@tanstack/react-start";
import { notifyCaseFiledFn } from "@/lib/email/notify.functions";

export const Route = createFileRoute("/_authenticated/cases/new")({
  ssr: false,
  component: NewCase,
});

function NewCase() {
  const { user, profile, isStaff, hasRole } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const notifyCaseFiled = useServerFn(notifyCaseFiledFn);

  // Staff/faculty file on behalf of the institution against a student, same
  // as before. Anyone else (students) is self-filing a report, which may be
  // about another student OR a staff member, and goes to pending_review
  // rather than straight into the active workflow.
  const isSelfReport = !(isStaff || hasRole("faculty"));

  const [form, setForm] = useState({
    reportee_type: "student" as "student" | "staff" | "non_staff",
    student_name: "",
    student_matric: "",
    student_department: "",
    student_level: "",
    title: "",
    offense_category: "Academic Misconduct",
    description: "",
    incident_date: "",
    incident_location: "",
    severity: "medium",
  });

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reporteeIsStudent = !isSelfReport || form.reportee_type === "student";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reporteeIsStudent && !isValidMatric(form.student_matric)) {
      return toast.error(`Invalid matric number. ${MATRIC_HELP}`);
    }
    setBusy(true);

    // try to resolve student by matric (only meaningful when reportee is a student)
    const student = reporteeIsStudent
      ? (
          await supabase
            .from("profiles")
            .select("id")
            .eq("matric_number", form.student_matric)
            .maybeSingle()
        ).data
      : null;

    const insert = {
      student_id: student?.id ?? null,
      student_name: form.student_name,
      student_matric: reporteeIsStudent ? form.student_matric : null,
      student_department: form.student_department || null,
      student_level: form.student_level || null,
      reportee_type: isSelfReport ? form.reportee_type : "student",
      reporter_id: user!.id,
      title: form.title,
      offense_category: form.offense_category,
      description: form.description,
      incident_date: form.incident_date || null,
      incident_location: form.incident_location || null,
      severity: form.severity as any,
      status: isSelfReport ? ("pending_review" as any) : ("reported" as any),
    };
    const { data: created, error } = await supabase
      .from("cases")
      .insert(insert as any)
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);

    await supabase.from("case_history").insert({
      case_id: created!.id,
      actor_id: user!.id,
      action: isSelfReport ? "Report submitted" : "Case filed",
      details: isSelfReport
        ? "Self-filed by student — awaiting staff review"
        : "Filed by reporter — initial status: reported",
    });

    if (!isSelfReport) {
      // Fire-and-forget panel notification. Self-filed reports are held
      // back until a staff member approves them (see cases.$caseId.tsx).
      notifyCaseFiled({ data: { caseId: created!.id } }).catch((err) => {
        console.error("notifyCaseFiled failed", err);
      });
    }

    toast.success(
      isSelfReport
        ? `Report ${created!.case_number} submitted for review`
        : `Case ${created!.case_number} filed`,
    );
    navigate({ to: "/cases/$caseId", params: { caseId: created!.id } });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/cases">
          <ArrowLeft /> Back to cases
        </Link>
      </Button>
      <div>
        <h1 className="font-display text-3xl font-semibold">
          {isSelfReport ? "Report someone" : "Report incident"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isSelfReport
            ? "Your report goes to staff for review before it becomes an active case."
            : "Submit a new disciplinary case for review."}
        </p>
      </div>

      <form onSubmit={submit}>
        {isSelfReport && (
          <Card className="mb-6">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Filed by:{" "}
              <span className="text-foreground font-medium">
                {profile?.full_name ?? user?.email}
              </span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              {isSelfReport ? "Who are you reporting?" : "Student"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {isSelfReport && (
              <div className="space-y-2 sm:col-span-2">
                <Label>They are a *</Label>
                <Select value={form.reportee_type} onValueChange={(v) => upd("reportee_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="staff">Staff / Lecturer</SelectItem>
                    <SelectItem value="non_staff">
                      Non-teaching staff (security, cleaner, porter, etc.)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Full name *</Label>
              <Input
                required
                value={form.student_name}
                onChange={(e) => upd("student_name", e.target.value)}
              />
            </div>
            {reporteeIsStudent ? (
              <>
                <div className="space-y-2">
                  <Label>Matric / Reg No. *</Label>
                  <Input
                    required
                    inputMode="numeric"
                    placeholder={MATRIC_PLACEHOLDER}
                    pattern="\d{3}/\d{2}/\d{1}/\d{4}"
                    title={MATRIC_HELP}
                    value={form.student_matric}
                    onChange={(e) => upd("student_matric", formatMatricInput(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">{MATRIC_HELP}</p>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={form.student_level} onValueChange={(v) => upd("student_level", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {["100L", "200L", "300L", "400L", "500L"].map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>
                          {lvl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Department</Label>
                  <Input
                    value={form.student_department}
                    onChange={(e) => upd("student_department", e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label>Department</Label>
                <Input
                  value={form.student_department}
                  onChange={(e) => upd("student_department", e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-lg">Incident</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title / summary *</Label>
              <Input
                required
                placeholder="e.g. Use of unauthorized materials in MTH101 exam"
                value={form.title}
                onChange={(e) => upd("title", e.target.value)}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Offense category</Label>
                <Select
                  value={form.offense_category}
                  onValueChange={(v) => upd("offense_category", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFENSE_CATEGORIES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => upd("severity", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incident date</Label>
                <Input
                  type="date"
                  value={form.incident_date}
                  onChange={(e) => upd("incident_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={form.incident_location}
                  onChange={(e) => upd("incident_location", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Detailed description *</Label>
              <Textarea
                required
                rows={6}
                value={form.description}
                onChange={(e) => upd("description", e.target.value)}
                placeholder="Provide a clear account of what happened, when, who was present, and any immediate actions taken."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link to="/cases">Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : isSelfReport ? "Submit report" : "File case"}
          </Button>
        </div>
      </form>
    </div>
  );
}
