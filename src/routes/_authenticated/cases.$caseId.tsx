import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Paperclip,
  Gavel,
  History,
  FileText,
  MessageSquareText,
  Upload,
  Trash2,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { notifyHearingScheduledFn, notifyCaseFiledFn } from "@/lib/email/notify.functions";
import { useCooldown } from "@/hooks/use-cooldown";
import {
  STATUS_LABELS,
  STATUS_TONE,
  SEVERITY_TONE,
  SANCTION_LABELS,
  SANCTION_PRESETS,
  OFFENSE_CATEGORIES,
  formatSanction,
} from "@/lib/case-meta";
import { MATRIC_HELP, MATRIC_PLACEHOLDER, formatMatricInput, isValidMatric } from "@/lib/matric";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  ssr: false,
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = useParams({ from: "/_authenticated/cases/$caseId" });
  const { user, isStaff, profile, hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const notifyCaseFiled = useServerFn(notifyCaseFiledFn);

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["case-history", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("case_history")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: evidence = [] } = useQuery({
    queryKey: ["evidence", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("evidence")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: hearings = [] } = useQuery({
    queryKey: ["hearings", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("hearings")
          .select("*")
          .eq("case_id", caseId)
          .order("scheduled_at", { ascending: false })
      ).data ?? [],
  });
  const { data: sanctions = [] } = useQuery({
    queryKey: ["sanctions", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("sanctions")
          .select("*")
          .eq("case_id", caseId)
          .order("issued_at", { ascending: false })
      ).data ?? [],
  });
  const { data: apologies = [] } = useQuery({
    queryKey: ["apologies", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("apology_letters")
          .select("*")
          .eq("case_id", caseId)
          .order("submitted_at", { ascending: false })
      ).data ?? [],
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading case…</div>;
  if (!c) return <div className="p-8">Case not found.</div>;

  const isOwnStudent = user?.id === c.student_id;
  // Only the Disciplinary Committee (or admin, as an override) can act on a
  // report while it's still pending_review — other staff can see it but not
  // touch it until it's been approved or dismissed.
  const canReviewPending = hasRole("committee") || hasRole("admin");
  const isPendingReview = c.status === "pending_review";
  const canEdit = isStaff
    ? c.status !== "closed" && (!isPendingReview || canReviewPending)
    : user?.id === c.reporter_id && c.status === "reported";
  const canSetStatus = isStaff && (!isPendingReview || canReviewPending);
  const canDelete = hasRole("admin");

  const log = async (action: string, details?: string) => {
    await supabase.from("case_history").insert({
      case_id: caseId,
      actor_id: user!.id,
      actor_name: profile?.full_name,
      action,
      details: details ?? null,
    });
  };

  const setStatus = async (status: string) => {
    const wasPendingReview = c.status === "pending_review";
    const { error } = await supabase
      .from("cases")
      .update({ status: status as any })
      .eq("id", caseId);
    if (error) return toast.error(error.message);

    if (wasPendingReview && status !== "pending_review") {
      if (status === "closed") {
        await log("Report dismissed", "Self-filed report reviewed and closed without action");
      } else {
        await log("Report approved", `→ ${STATUS_LABELS[status]}`);
        // The panel-wide "new case" email was held back at filing time for
        // self-filed reports — send it now that staff has approved it.
        notifyCaseFiled({ data: { caseId } }).catch((err) => {
          console.error("notifyCaseFiled failed", err);
        });
      }
    } else {
      await log("Status updated", `→ ${STATUS_LABELS[status]}`);
    }

    qc.invalidateQueries({ queryKey: ["case", caseId] });
    qc.invalidateQueries({ queryKey: ["case-history", caseId] });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["hearings", "all"] });
    toast.success("Status updated");
  };

  const deleteCase = async () => {
    const { error } = await supabase.from("cases").delete().eq("id", caseId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cases"] });
    toast.success("Case deleted");
    navigate({ to: "/cases" });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/cases">
          <ArrowLeft /> All cases
        </Link>
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{c.case_number}</p>
          <h1 className="font-display text-3xl font-semibold mt-1">{c.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className={STATUS_TONE[c.status]}>
              {STATUS_LABELS[c.status]}
            </Badge>
            <Badge variant="outline" className={SEVERITY_TONE[c.severity]}>
              {c.severity}
            </Badge>
            <Badge variant="secondary">{c.offense_category}</Badge>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {isPendingReview ? (
            canReviewPending ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setStatus("reported")}>
                  <Check /> Accept
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                    >
                      <X /> Reject
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject this report?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The report will be closed without becoming an active case. This can't be
                        undone from here.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setStatus("closed")}>
                        Reject
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              isStaff && (
                <p className="text-xs text-muted-foreground italic">
                  Awaiting review by the Disciplinary Committee
                </p>
              )
            )
          ) : (
            canSetStatus && (
              <>
                <Label className="text-xs text-muted-foreground">Set status</Label>
                <Select value={c.status} onValueChange={setStatus}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this case?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes case {c.case_number} and all related history, evidence
                    records, hearings, sanctions, and apology letters. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteCase}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {canEdit && (
        <EditCaseDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          caseRow={c}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["case", caseId] });
            qc.invalidateQueries({ queryKey: ["case-history", caseId] });
            qc.invalidateQueries({ queryKey: ["cases"] });
          }}
          log={log}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {c.reportee_type === "staff"
                ? "Staff reported"
                : c.reportee_type === "non_staff"
                  ? "Non-teaching staff reported"
                  : "Student"}
            </p>
            <p className="font-medium mt-1">{c.student_name}</p>
            {c.reportee_type !== "staff" && c.reportee_type !== "non_staff" && (
              <p className="text-xs text-muted-foreground font-mono">{c.student_matric}</p>
            )}
            {c.student_department && (
              <p className="text-xs text-muted-foreground mt-1">
                {c.student_department} · {c.student_level}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Incident</p>
            <p className="text-sm mt-1">
              {c.incident_date ? format(new Date(c.incident_date), "PPP") : "Date not specified"}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.incident_location ?? "Location not specified"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Filed</p>
            <p className="text-sm mt-1">{format(new Date(c.created_at), "PPP")}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="evidence">
            <Paperclip className="size-4" /> Evidence ({evidence.length})
          </TabsTrigger>
          <TabsTrigger value="hearings">
            <Calendar className="size-4" /> Hearings ({hearings.length})
          </TabsTrigger>
          <TabsTrigger value="sanctions">
            <Gavel className="size-4" /> Sanctions ({sanctions.length})
          </TabsTrigger>
          <TabsTrigger value="apology">
            <MessageSquareText className="size-4" /> Apology ({apologies.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <EvidenceTab
            caseId={caseId}
            canManage={isStaff || user?.id === c.reporter_id}
            items={evidence}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["evidence", caseId] });
              qc.invalidateQueries({ queryKey: ["case-history", caseId] });
            }}
            log={log}
          />
        </TabsContent>

        <TabsContent value="hearings" className="mt-4">
          <HearingsTab
            caseId={caseId}
            canManage={isStaff}
            canSubmitUnavailability={!!isOwnStudent}
            items={hearings}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["hearings", caseId] });
              qc.invalidateQueries({ queryKey: ["case-history", caseId] });
            }}
            log={log}
          />
        </TabsContent>

        <TabsContent value="sanctions" className="mt-4">
          <SanctionsTab
            caseId={caseId}
            canManage={isStaff}
            items={sanctions}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["sanctions", caseId] });
              qc.invalidateQueries({ queryKey: ["case-history", caseId] });
            }}
            log={log}
          />
        </TabsContent>

        <TabsContent value="apology" className="mt-4">
          <ApologyTab
            caseId={caseId}
            canSubmit={!!isOwnStudent}
            canReview={isStaff}
            items={apologies}
            studentId={c.student_id}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["apologies", caseId] });
              qc.invalidateQueries({ queryKey: ["case-history", caseId] });
            }}
            log={log}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              {history.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
              )}
              {history.map((h) => (
                <div key={h.id} className="flex gap-3 pb-3 border-b last:border-0">
                  <div className="size-8 rounded-full bg-accent text-accent-foreground grid place-items-center shrink-0 text-xs">
                    •
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{h.action}</p>
                    {h.details && (
                      <p className="text-sm text-muted-foreground mt-0.5">{h.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {h.actor_name ?? "System"} ·{" "}
                      {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EvidenceTab({ caseId, canManage, items, onDone, log }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file first");
    setBusy(true);
    const path = `${caseId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("evidence").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("evidence").insert({
      case_id: caseId,
      uploader_id: user!.id,
      file_path: path,
      file_name: file.name,
      file_type: file.type,
      description: desc || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await log("Evidence added", file.name);
    setDesc("");
    if (fileRef.current) fileRef.current.value = "";
    onDone();
    toast.success("Evidence uploaded");
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (id: string, path: string) => {
    const { error: storageErr } = await supabase.storage.from("evidence").remove([path]);
    if (storageErr) {
      toast.error("Failed to delete file: " + storageErr.message);
      return;
    }
    const { error: dbErr } = await supabase.from("evidence").delete().eq("id", id);
    if (dbErr) return toast.error(dbErr.message);
    await log("Evidence removed");
    onDone();
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Upload evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input ref={fileRef} type="file" />
            <Textarea
              placeholder="Description (optional)"
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <Button onClick={upload} disabled={busy}>
              <Upload /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5 space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No evidence uploaded.</p>
          )}
          {items.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 p-3 border rounded-md">
              <Paperclip className="size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{e.file_name}</p>
                {e.description && (
                  <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => download(e.file_path, e.file_name)}
              >
                <Download />
              </Button>
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => remove(e.id, e.file_path)}>
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HearingsTab({ caseId, canManage, canSubmitUnavailability, items, onDone, log }: any) {
  const [form, setForm] = useState({ scheduled_at: "", location: "", notes: "" });
  const [outcomeDialog, setOutcomeDialog] = useState<{ id: string; outcome: string } | null>(null);
  const { user } = useAuth();
  const notifyHearingScheduled = useServerFn(notifyHearingScheduledFn);

  const scheduleCooldown = useCooldown(`schedule-hearing-${caseId}`, 30);

  const schedule = async () => {
    if (scheduleCooldown.isActive) return;
    if (!form.scheduled_at) return toast.error("Pick a date/time");
    const { data: created, error } = await supabase
      .from("hearings")
      .insert({
        case_id: caseId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    scheduleCooldown.start();
    await supabase
      .from("cases")
      .update({ status: "hearing_scheduled" as any })
      .eq("id", caseId);
    await log(
      "Hearing scheduled",
      `${new Date(form.scheduled_at).toLocaleString()} at ${form.location || "TBD"}`,
    );
    if (created?.id) {
      try {
        const notification = await notifyHearingScheduled({ data: { hearingId: created.id } });
        if (!notification.studentSent) {
          toast.error("Hearing scheduled, but the student email was not sent.");
        } else if (!notification.ok) {
          toast.warning("Student email sent, but some staff notifications failed.");
        }
      } catch (err) {
        console.error("notifyHearingScheduled failed", err);
        toast.error("Hearing scheduled, but the email notification failed.");
      }
    }
    setForm({ scheduled_at: "", location: "", notes: "" });
    onDone();
    toast.success("Hearing scheduled");
  };

  const updateStatus = async (id: string, status: string, outcome?: string) => {
    await supabase
      .from("hearings")
      .update({ status: status as any, outcome: outcome ?? null })
      .eq("id", id);
    await log(`Hearing ${status}`);
    onDone();
  };

  const submitUnavailability = async (id: string, reason: string) => {
    if (!reason.trim()) return toast.error("Please provide a reason");
    const { error } = await supabase
      .from("hearings")
      .update({ unavailability_reason: reason } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    await log("Unavailability submitted", reason);
    toast.success("Submitted — awaiting committee review");
    onDone();
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Schedule a hearing</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Committee Room 2"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes / panel members</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={schedule} disabled={scheduleCooldown.isActive}>
                <Calendar />{" "}
                {scheduleCooldown.isActive ? `Wait ${scheduleCooldown.secondsLeft}s` : "Schedule"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5 space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No hearings scheduled.</p>
          )}
          {items.map((h: any) => (
            <HearingCard
              key={h.id}
              hearing={h}
              canManage={canManage}
              canSubmitUnavailability={canSubmitUnavailability}
              notifyHearingScheduled={notifyHearingScheduled}
              updateStatus={updateStatus}
              submitUnavailability={submitUnavailability}
              setOutcomeDialog={setOutcomeDialog}
            />
          ))}
        </CardContent>
      </Card>
      {outcomeDialog && (
        <Dialog open onOpenChange={() => setOutcomeDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record hearing outcome</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Outcome / summary</Label>
              <Textarea
                rows={4}
                value={outcomeDialog.outcome}
                onChange={(e) =>
                  setOutcomeDialog((d) => (d ? { ...d, outcome: e.target.value } : d))
                }
                placeholder="Summarise the hearing decision…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOutcomeDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await updateStatus(
                    outcomeDialog.id,
                    "completed",
                    outcomeDialog.outcome || undefined,
                  );
                  setOutcomeDialog(null);
                }}
              >
                Save outcome
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function HearingCard({
  hearing: h,
  canManage,
  canSubmitUnavailability,
  notifyHearingScheduled,
  updateStatus,
  submitUnavailability,
  setOutcomeDialog,
}: any) {
  const resendCooldown = useCooldown(`resend-hearing-${h.id}`, 30);

  const sendHearingEmail = async () => {
    if (resendCooldown.isActive) return;
    resendCooldown.start();
    try {
      const notification = await notifyHearingScheduled({ data: { hearingId: h.id } });
      if (!notification.studentSent) {
        toast.error(
          "Student email was not sent. Check that the student profile has a valid email.",
        );
      } else if (!notification.ok) {
        toast.warning("Student email sent, but some staff notifications failed.");
      } else {
        toast.success("Hearing email sent to the student.");
      }
    } catch (err) {
      console.error("notifyHearingScheduled failed", err);
      toast.error("Email notification failed.");
    }
  };

  return (
    <div className="border rounded-md p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium">{format(new Date(h.scheduled_at), "PPP 'at' p")}</p>
          {h.location && <p className="text-sm text-muted-foreground">📍 {h.location}</p>}
          {h.notes && <p className="text-sm mt-1">{h.notes}</p>}
          {h.outcome && (
            <p className="text-sm mt-2">
              <span className="font-medium">Outcome:</span> {h.outcome}
            </p>
          )}
        </div>
        <Badge variant="outline">{h.status}</Badge>
      </div>

      {h.unavailability_reason && (
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Your unavailability request
            </p>
            <Badge variant="outline">{h.unavailability_status ?? "pending"}</Badge>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{h.unavailability_reason}</p>
          {h.unavailability_review_notes && (
            <p className="text-xs text-muted-foreground mt-1">
              Committee note: {h.unavailability_review_notes}
            </p>
          )}
        </div>
      )}

      {canSubmitUnavailability &&
        h.status === "scheduled" &&
        h.unavailability_status !== "approved" && (
          <UnavailabilityForm
            initial={h.unavailability_reason ?? ""}
            onSubmit={(reason) => submitUnavailability(h.id, reason)}
          />
        )}

      {canManage && h.status === "scheduled" && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={sendHearingEmail}
            disabled={resendCooldown.isActive}
          >
            {resendCooldown.isActive ? `Wait ${resendCooldown.secondsLeft}s` : "Resend email"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOutcomeDialog({ id: h.id, outcome: "" })}
          >
            Mark completed
          </Button>
          <Button size="sm" variant="ghost" onClick={() => updateStatus(h.id, "cancelled")}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function UnavailabilityForm({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: (r: string) => void;
}) {
  const [reason, setReason] = useState(initial);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
        {initial ? "Update unavailability reason" : "I can't attend — submit a reason"}
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Reason for unavailability
      </Label>
      <Textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why you cannot attend on the scheduled date…"
      />
      <p className="text-xs text-muted-foreground">
        Only the Disciplinary Committee can approve or reject this request.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSubmit(reason);
            setOpen(false);
          }}
        >
          Submit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SanctionsTab({ caseId, canManage, items, onDone, log }: any) {
  const [form, setForm] = useState({
    type: "warning",
    description: "",
    duration_days: "",
    duration_semesters: "",
  });
  const { user } = useAuth();
  const applyPreset = (p: (typeof SANCTION_PRESETS)[number]) => {
    setForm({
      type: p.type,
      description: p.description,
      duration_days: "",
      duration_semesters: p.duration_semesters ? String(p.duration_semesters) : "",
    });
  };
  const issue = async () => {
    const { error } = await supabase.from("sanctions").insert({
      case_id: caseId,
      type: form.type as any,
      description: form.description || null,
      duration_days: form.duration_days ? Number(form.duration_days) : null,
      duration_semesters: form.duration_semesters ? Number(form.duration_semesters) : null,
      issued_by: user!.id,
    });
    if (error) return toast.error(error.message);
    await supabase
      .from("cases")
      .update({ status: "decided" as any })
      .eq("id", caseId);
    await log(
      "Sanction issued",
      formatSanction({
        type: form.type,
        duration_semesters: form.duration_semesters ? Number(form.duration_semesters) : null,
        duration_days: form.duration_days ? Number(form.duration_days) : null,
        description: form.description,
      }),
    );
    setForm({ type: "warning", description: "", duration_days: "", duration_semesters: "" });
    onDone();
    toast.success("Sanction recorded");
  };
  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Issue sanction / decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Quick decision
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SANCTION_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SANCTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semesters</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 1"
                  value={form.duration_semesters}
                  onChange={(e) => setForm((f) => ({ ...f, duration_semesters: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Days (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.duration_days}
                  onChange={(e) => setForm((f) => ({ ...f, duration_days: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label>Description / rationale</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-3">
                <Button onClick={issue}>
                  <Gavel /> Issue sanction
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5 space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No decision issued yet.
            </p>
          )}
          {items.map((s: any) => (
            <div key={s.id} className="border rounded-md p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge>{SANCTION_LABELS[s.type]}</Badge>
                  <p className="font-display text-lg mt-2">{formatSanction(s)}</p>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(s.issued_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApologyTab({ caseId, canSubmit, canReview, items, studentId, onDone, log }: any) {
  const [content, setContent] = useState("");
  const [reviewDialog, setReviewDialog] = useState<{
    id: string;
    status: "accepted" | "rejected";
    notes: string;
  } | null>(null);
  const { user } = useAuth();
  const submit = async () => {
    if (!content.trim()) return toast.error("Write a letter first");
    const { error } = await supabase.from("apology_letters").insert({
      case_id: caseId,
      student_id: studentId ?? user!.id,
      content,
    });
    if (error) return toast.error(error.message);
    await log("Apology letter submitted");
    setContent("");
    onDone();
    toast.success("Letter submitted");
  };
  const confirmReview = async () => {
    if (!reviewDialog) return;
    const { status, id, notes } = reviewDialog;
    await supabase
      .from("apology_letters")
      .update({
        status,
        reviewer_notes: notes || null,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    await log(`Apology ${status}`);
    setReviewDialog(null);
    onDone();
  };
  return (
    <div className="space-y-4">
      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Submit apology letter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Dear Committee, …"
            />
            <Button onClick={submit}>Submit letter</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-5 space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No apology letters submitted.
            </p>
          )}
          {items.map((a: any) => (
            <div key={a.id} className="border rounded-md p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true })}
                </p>
                <Badge variant="outline">{a.status}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm mt-3 leading-relaxed">{a.content}</p>
              {a.reviewer_notes && (
                <>
                  <Separator className="my-3" />
                  <p className="text-sm">
                    <span className="font-medium">Reviewer:</span> {a.reviewer_notes}
                  </p>
                </>
              )}
              {canReview && a.status === "submitted" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => setReviewDialog({ id: a.id, status: "accepted", notes: "" })}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReviewDialog({ id: a.id, status: "rejected", notes: "" })}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EditCaseDialog({ open, onOpenChange, caseRow, onSaved, log }: any) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: caseRow.title ?? "",
    offense_category: caseRow.offense_category ?? "Academic Misconduct",
    severity: caseRow.severity ?? "medium",
    description: caseRow.description ?? "",
    incident_date: caseRow.incident_date ?? "",
    incident_location: caseRow.incident_location ?? "",
    student_name: caseRow.student_name ?? "",
    student_matric: caseRow.student_matric ?? "",
    student_department: caseRow.student_department ?? "",
    student_level: caseRow.student_level ?? "",
  });
  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reporteeIsStudent = !["staff", "non_staff"].includes(caseRow.reportee_type ?? "student");

  const save = async () => {
    if (reporteeIsStudent && !isValidMatric(form.student_matric)) {
      return toast.error(`Invalid matric number. ${MATRIC_HELP}`);
    }
    setBusy(true);
    const { error } = await supabase
      .from("cases")
      .update({
        title: form.title,
        offense_category: form.offense_category,
        severity: form.severity as any,
        description: form.description,
        incident_date: form.incident_date || null,
        incident_location: form.incident_location || null,
        student_name: form.student_name,
        student_matric: reporteeIsStudent ? form.student_matric : null,
        student_department: form.student_department || null,
        student_level: form.student_level || null,
      })
      .eq("id", caseRow.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await log("Case edited");
    onSaved();
    onOpenChange(false);
    toast.success("Case updated");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit case</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => upd("title", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
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
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={form.description}
              onChange={(e) => upd("description", e.target.value)}
            />
          </div>
          <Separator />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {reporteeIsStudent
                  ? "Student name"
                  : caseRow.reportee_type === "non_staff"
                    ? "Non-teaching staff name"
                    : "Staff name"}
              </Label>
              <Input
                value={form.student_name}
                onChange={(e) => upd("student_name", e.target.value)}
              />
            </div>
            {reporteeIsStudent && (
              <div className="space-y-2">
                <Label>Matric / Reg No.</Label>
                <Input
                  inputMode="numeric"
                  placeholder={MATRIC_PLACEHOLDER}
                  pattern="\d{3}/\d{2}/\d{1}/\d{4}"
                  title={MATRIC_HELP}
                  value={form.student_matric}
                  onChange={(e) => upd("student_matric", formatMatricInput(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{MATRIC_HELP}</p>
              </div>
            )}
            {reporteeIsStudent && (
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
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Department</Label>
              <Input
                value={form.student_department}
                onChange={(e) => upd("student_department", e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
