import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Calendar, CalendarPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { notifyHearingScheduledFn } from "@/lib/email/notify.functions";

export const Route = createFileRoute("/_authenticated/hearings")({
  ssr: false,
  component: HearingsPage,
});

// Cooldown hook — persists across refreshes via localStorage
function useCooldown(key: string, seconds = 30) {
  const storageKey = `cooldown_${key}`;

  const getRemaining = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return 0;
      const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  };

  const [remaining, setRemaining] = useState(getRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = () => {
    const r = getRemaining();
    setRemaining(r);
    if (r <= 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Start interval on mount if cooldown is already active (survives remounts)
  useEffect(() => {
    const r = getRemaining();
    if (r > 0) {
      setRemaining(r);
      intervalRef.current = setInterval(tick, 500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // empty deps — runs once on mount

  const start = () => {
    try {
      localStorage.setItem(storageKey, String(Date.now() + seconds * 1000));
    } catch {}
    setRemaining(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 500);
  };

  return { remaining, start, disabled: remaining > 0 };
}

// Each hearing row owns both its resend and schedule cooldowns
function HearingRow({
  h,
  isAdmin,
  onDelete,
  onSendEmail,
  onSchedule,
  canReview,
  onReviewed,
}: {
  h: any;
  isAdmin: boolean;
  onDelete: (h: any) => void;
  onSendEmail: (id: string) => Promise<void>;
  onSchedule: (h: any) => void;
  canReview: boolean;
  onReviewed: () => void;
}) {
  const resendCooldown = useCooldown(`resend_${h.id}`);
  const scheduleCooldown = useCooldown(`schedule_${h.case_id}`);

  const handleResend = async () => {
    resendCooldown.start();
    await onSendEmail(h.id);
  };

  const handleSchedule = () => {
    scheduleCooldown.start();
    onSchedule(h);
  };

  return (
    <div className="p-4 border rounded-md hover:bg-accent/30">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/cases/$caseId" params={{ caseId: h.case_id }} className="flex-1 min-w-0">
          <p className="font-medium">{h.cases?.title}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {h.cases?.case_number} · {h.cases?.student_name}
          </p>
        </Link>
        <div className="text-right">
          {h.scheduled_at ? (
            <>
              <p className="text-sm">{format(new Date(h.scheduled_at), "PPP 'at' p")}</p>
              {h.location && <p className="text-xs text-muted-foreground">{h.location}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Awaiting schedule</p>
          )}
        </div>
        <Badge variant={h.unscheduled ? "secondary" : "outline"}>{h.status}</Badge>
        {h.unscheduled && (
          <Button size="sm" disabled={scheduleCooldown.disabled} onClick={handleSchedule}>
            <CalendarPlus />
            {scheduleCooldown.disabled ? `Wait (${scheduleCooldown.remaining}s)` : "Schedule"}
          </Button>
        )}
        {!h.unscheduled && (
          <Button
            size="sm"
            variant="outline"
            disabled={resendCooldown.disabled}
            onClick={handleResend}
          >
            {resendCooldown.disabled ? `Resend (${resendCooldown.remaining}s)` : "Resend email"}
          </Button>
        )}
        {isAdmin && !h.unscheduled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this hearing?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes only the hearing record. The case itself stays open and will return
                  to "under review" so a new hearing can be scheduled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(h)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete hearing
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {h.unavailability_reason && (
        <UnavailabilityBlock hearing={h} canReview={canReview} onReviewed={onReviewed} />
      )}
    </div>
  );
}

function HearingsPage() {
  const { isStaff, user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [scheduling, setScheduling] = useState<null | {
    caseId: string;
    caseNumber: string;
    title: string;
  }>(null);
  const notifyHearingScheduled = useServerFn(notifyHearingScheduledFn);
  const isAdmin = hasRole("admin");

  const deleteHearing = async (h: any) => {
    const { error } = await supabase.from("hearings").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("cases")
      .update({ status: "under_review" as any })
      .eq("id", h.case_id)
      .eq("status", "hearing_scheduled" as any);
    await supabase.from("case_history").insert({
      case_id: h.case_id,
      actor_id: user?.id ?? null,
      action: "Hearing deleted",
      details: h.scheduled_at
        ? `Removed hearing previously scheduled for ${new Date(h.scheduled_at).toLocaleString()}`
        : "Removed hearing",
    });
    toast.success("Hearing deleted");
    qc.invalidateQueries({ queryKey: ["hearings", "all"] });
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const sendHearingEmail = async (hearingId: string) => {
    try {
      const notification = await notifyHearingScheduled({ data: { hearingId } });
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

  const { data = [] } = useQuery({
    queryKey: ["hearings", "all"],
    queryFn: async () => {
      const [{ data: hearings }, { data: pendingCases }] = await Promise.all([
        supabase
          .from("hearings")
          .select("*, cases(case_number, title, student_name, student_matric)")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("cases")
          .select("id, case_number, title, student_name, student_matric")
          .eq("status", "hearing_scheduled"),
      ]);

      const rows = (hearings ?? []).map((h: any) => ({
        id: h.id,
        case_id: h.case_id,
        scheduled_at: h.scheduled_at,
        location: h.location,
        status: h.status,
        cases: h.cases,
        unavailability_reason: h.unavailability_reason,
        unavailability_status: h.unavailability_status,
        unavailability_submitted_at: h.unavailability_submitted_at,
        unavailability_review_notes: h.unavailability_review_notes,
        unscheduled: false,
      }));

      const haveHearing = new Set(rows.map((r) => r.case_id));
      for (const c of pendingCases ?? []) {
        if (!haveHearing.has(c.id)) {
          rows.push({
            id: `pending-${c.id}`,
            case_id: c.id,
            scheduled_at: null as any,
            location: null,
            status: "pending",
            cases: {
              case_number: c.case_number,
              title: c.title,
              student_name: c.student_name,
              student_matric: c.student_matric,
            },
            unavailability_reason: null,
            unavailability_status: null,
            unavailability_submitted_at: null,
            unavailability_review_notes: null,
            unscheduled: true,
          });
        }
      }
      return rows;
    },
  });

  if (!isStaff)
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Staff only.</CardContent>
        </Card>
      </div>
    );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Hearings</h1>
        <p className="text-muted-foreground mt-1">All scheduled, pending, and past hearings.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Calendar className="size-5" /> Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hearings yet.</p>
          )}
          {data.map((h: any) => (
            <HearingRow
              key={h.id}
              h={h}
              isAdmin={isAdmin}
              onDelete={deleteHearing}
              onSendEmail={sendHearingEmail}
              onSchedule={(h) =>
                setScheduling({
                  caseId: h.case_id,
                  caseNumber: h.cases?.case_number ?? "",
                  title: h.cases?.title ?? "",
                })
              }
              canReview={hasRole("committee") || hasRole("admin")}
              onReviewed={() => qc.invalidateQueries({ queryKey: ["hearings", "all"] })}
            />
          ))}
        </CardContent>
      </Card>

      <ScheduleDialog
        target={scheduling}
        onClose={() => setScheduling(null)}
        userId={user?.id ?? ""}
        onScheduled={() => {
          qc.invalidateQueries({ queryKey: ["hearings", "all"] });
          qc.invalidateQueries({ queryKey: ["cases"] });
        }}
      />
    </div>
  );
}

function ScheduleDialog({
  target,
  onClose,
  userId,
  onScheduled,
}: {
  target: { caseId: string; caseNumber: string; title: string } | null;
  onClose: () => void;
  userId: string;
  onScheduled: () => void;
}) {
  const [form, setForm] = useState({ scheduled_at: "", location: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const notifyHearingScheduled = useServerFn(notifyHearingScheduledFn);

  const submit = async () => {
    if (!target) return;
    if (!form.scheduled_at) return toast.error("Pick a date and time");
    setBusy(true);
    const { data: created, error } = await supabase
      .from("hearings")
      .insert({
        case_id: target.caseId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (!error) {
      await supabase
        .from("cases")
        .update({ status: "hearing_scheduled" as any })
        .eq("id", target.caseId);
      await supabase.from("case_history").insert({
        case_id: target.caseId,
        actor_id: userId,
        action: "Hearing scheduled",
        details: `${new Date(form.scheduled_at).toLocaleString()} at ${form.location || "TBD"}`,
      });
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
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Hearing scheduled");
    setForm({ scheduled_at: "", location: "", notes: "" });
    onScheduled();
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule hearing</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-mono">{target.caseNumber}</span> — {target.title}
            </div>
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
                placeholder="Committee Room 2"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes / panel members</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnavailabilityBlock({
  hearing,
  canReview,
  onReviewed,
}: {
  hearing: any;
  canReview: boolean;
  onReviewed: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const review = async (decision: "approved" | "rejected") => {
    setBusy(true);
    const { error } = await supabase
      .from("hearings")
      .update({
        unavailability_status: decision,
        unavailability_review_notes: notes || null,
      } as any)
      .eq("id", hearing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Unavailability ${decision}`);
    setNotes("");
    onReviewed();
  };

  const tone =
    hearing.unavailability_status === "approved"
      ? "text-emerald-700"
      : hearing.unavailability_status === "rejected"
        ? "text-rose-700"
        : "text-amber-700";

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Student unavailability
        </p>
        <Badge variant="outline" className={tone}>
          {hearing.unavailability_status ?? "pending"}
        </Badge>
      </div>
      <p className="text-sm whitespace-pre-wrap">{hearing.unavailability_reason}</p>
      {hearing.unavailability_review_notes && (
        <p className="text-xs text-muted-foreground">
          Committee note: {hearing.unavailability_review_notes}
        </p>
      )}
      {canReview &&
        hearing.unavailability_status !== "approved" &&
        hearing.unavailability_status !== "rejected" && (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Optional notes for the student"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review("approved")} disabled={busy}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => review("rejected")}
                disabled={busy}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
