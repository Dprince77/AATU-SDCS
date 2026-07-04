import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth, ASSIGNABLE_ROLES, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { deleteUserAccount } from "@/lib/admin.functions";
import { addUserRole, removeUserRole } from "@/lib/roles.functions";
import { MATRIC_HELP, formatMatricInput, isValidMatric } from "@/lib/matric";
import { FACULTIES, type Faculty, isFaculty } from "@/lib/faculty";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: AdminPage,
});

// Administration (admin) is a separate role — not a staff member.
const STAFF_ROLES: AppRole[] = ["dsa", "dean", "lecturer", "committee", "chair", "staff"];

type Person = {
  id: string;
  full_name: string;
  email: string | null;
  matric_number: string | null;
  staff_id: string | null;
  department: string | null;
  faculty: string | null;
  level: string | null;
  phone: string | null;
  roles: AppRole[];
  // Faculty scope for the Dean role, if any.
  dean_faculty: string | null;
};

function AdminPage() {
  const { hasRole, user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("committee");
  const [editing, setEditing] = useState<Person | null>(null);
  const deleteAccount = useServerFn(deleteUserAccount);

  const isAdmin = hasRole("admin");
  const isManager = isAdmin || hasRole("dsa") || hasRole("dean");
  const [deanFaculty, setDeanFaculty] = useState<Faculty>(FACULTIES[0]);
  const addRoleFn = useServerFn(addUserRole);
  const removeRoleFn = useServerFn(removeUserRole);

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["admin", "people"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role, faculty"),
      ]);
      const byUser = new Map<string, AppRole[]>();
      const deanScope = new Map<string, string>();
      roles?.forEach((r: { user_id: string; role: AppRole; faculty: string | null }) => {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        byUser.get(r.user_id)!.push(r.role);
        if (r.role === "dean" && r.faculty) deanScope.set(r.user_id, r.faculty);
      });
      return (profs ?? []).map((p) => ({
        ...(p as Omit<Person, "roles" | "dean_faculty">),
        roles: byUser.get(p.id) ?? [],
        dean_faculty: deanScope.get(p.id) ?? null,
      }));
    },
  });

  // Added before the isManager guard:
  if (authLoading) return null;
  if (!isManager) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Admin / DSA / Dean only.
          </CardContent>
        </Card>
      </div>
    );
  }

  const addRole = async (userId: string, role: AppRole) => {
    try {
      await addRoleFn({
        data: role === "dean" ? { userId, role, faculty: deanFaculty } : { userId, role },
      });
      qc.invalidateQueries({ queryKey: ["admin", "people"] });
      toast.success(
        role === "dean" ? `Dean of ${deanFaculty} granted` : `${ROLE_LABELS[role] ?? role} granted`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign role");
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      await removeRoleFn({ data: { userId, role } });
      qc.invalidateQueries({ queryKey: ["admin", "people"] });
      toast.success("Role removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove role");
    }
  };
  const deletePerson = async (p: Person) => {
    try {
      await deleteAccount({ data: { userId: p.id } });
      toast.success(`Deleted ${p.full_name || p.email || "account"}`);
      qc.invalidateQueries({ queryKey: ["admin", "people"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete account");
    }
  };

  const filtered = people.filter((p) => {
    const s = search.toLowerCase();
    return (
      !s ||
      p.full_name?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.matric_number?.toLowerCase().includes(s) ||
      p.staff_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Administration</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "Manage user roles, student profiles, and staff details."
            : "Edit student profile details (matric number, level, department, full name)."}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Users</CardTitle>
          <div className="flex gap-3 mt-3 flex-wrap">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Default new role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newRole === "dean" && (
                  <>
                    <Label className="text-xs">Faculty</Label>
                    <Select value={deanFaculty} onValueChange={(v) => setDeanFaculty(v as Faculty)}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FACULTIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((p) => {
            const isStaffMember = p.roles.some((r) => STAFF_ROLES.includes(r));
            const canEdit = isAdmin || (!isStaffMember && isManager);
            return (
              <div key={p.id} className="border rounded-md p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.email}
                      {p.matric_number && ` · Matric ${p.matric_number}`}
                      {p.staff_id && ` · Staff ID ${p.staff_id}`}
                    </p>
                    {(p.department || p.level) && (
                      <p className="text-xs text-muted-foreground">
                        {[p.department, p.level].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.roles.map((r) =>
                      isAdmin ? (
                        <Badge
                          key={r}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeRole(p.id, r)}
                        >
                          {ROLE_LABELS[r] ?? r}
                          {r === "dean" && p.dean_faculty ? ` · ${p.dean_faculty}` : ""} ×
                        </Badge>
                      ) : (
                        <Badge key={r} variant="secondary">
                          {ROLE_LABELS[r] ?? r}
                          {r === "dean" && p.dean_faculty ? ` · ${p.dean_faculty}` : ""}
                        </Badge>
                      ),
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => addRole(p.id, newRole)}>
                        + {ROLE_LABELS[newRole]}
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        <Pencil /> Edit
                      </Button>
                    )}
                    {isAdmin && p.id !== user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes {p.full_name || p.email} and all their roles.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePerson(p)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {editing && (
        <EditPersonDialog
          person={editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "people"] })}
        />
      )}
    </div>
  );
}

function EditPersonDialog({
  person, isAdmin, onClose, onSaved,
}: {
  person: Person;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isStaffMember = person.roles.some((r) => STAFF_ROLES.includes(r));
  const [form, setForm] = useState({
    full_name: person.full_name ?? "",
    matric_number: person.matric_number ?? "",
    staff_id: person.staff_id ?? "",
    department: person.department ?? "",
    faculty: (isFaculty(person.faculty) ? person.faculty : "") as string,
    level: person.level ?? "",
    phone: person.phone ?? "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!isStaffMember && form.matric_number && !isValidMatric(form.matric_number)) {
      return toast.error(`Invalid matric number. ${MATRIC_HELP}`);
    }
    setBusy(true);
    const patch: {
      full_name: string;
      department: string | null;
      faculty: string | null;
      level: string | null;
      phone: string | null;
      matric_number?: string | null;
      staff_id?: string | null;
    } = {
      full_name: form.full_name,
      department: form.department || null,
      faculty: form.faculty || null,
      level: form.level || null,
      phone: form.phone || null,
    };
    if (!isStaffMember) {
      patch.matric_number = form.matric_number || null;
    } else if (isAdmin) {
      patch.staff_id = form.staff_id || null;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", person.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {isStaffMember ? "staff" : "student"} profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          {isStaffMember ? (
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                disabled={!isAdmin}
              />
              {!isAdmin && <p className="text-xs text-muted-foreground">Only an administrator can change staff IDs.</p>}
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Matric No.</Label>
                  <Input
                    inputMode="numeric"
                    pattern="\d{3}/\d{2}/\d{1}/\d{4}"
                    value={form.matric_number}
                    onChange={(e) => setForm({ ...form, matric_number: formatMatricInput(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">{MATRIC_HELP}</p>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Faculty</Label>
                <Select value={form.faculty} onValueChange={(v) => setForm({ ...form, faculty: v })}>
                  <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                  <SelectContent>{FACULTIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
