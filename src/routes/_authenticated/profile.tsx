import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { FACULTIES } from "@/lib/faculty";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, roles, isStaff, refresh } = useAuth();
  const isAdmin = roles.includes("admin");
  const isStudent = !isStaff && !isAdmin;
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    department: profile?.department ?? "",
    faculty: profile?.faculty ?? "",
    level: profile?.level ?? "",
    phone: profile?.phone ?? "",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refresh();
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">My profile</h1>
        <p className="text-muted-foreground mt-1">
          Roles: {roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "none"}
        </p>
      </div>
      <form onSubmit={save}>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Account details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>

            {isStudent ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Matric No.</Label>
                    <Input value={profile?.matric_number ?? ""} disabled readOnly />
                    <p className="text-xs text-muted-foreground">Only an administrator, DSA, or Dean can change this.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Input placeholder="e.g. 300L" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input placeholder="e.g. Computer Science" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Faculty</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.faculty}
                    onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                  >
                    <option value="">Select your faculty</option>
                    {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </>
            ) : isStaff ? (
              <div className="space-y-2">
                <Label>Staff ID</Label>
                <Input value={profile?.staff_id ?? ""} disabled readOnly />
                <p className="text-xs text-muted-foreground">Only an administrator can change staff details.</p>
              </div>
            ) : null}

            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
