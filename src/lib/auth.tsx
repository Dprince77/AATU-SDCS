import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// "hod" is retained here only because the DB enum still includes it for
// backwards compatibility. It is intentionally absent from ROLE_LABELS and
// ASSIGNABLE_ROLES so it can never be granted from the UI.
export type AppRole = "admin" | "dsa" | "dean" | "lecturer" | "committee" | "student" | "chair" | "faculty" | "staff" | "hod";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administration",
  dsa: "DSA",
  dean: "Dean of Faculty",
  lecturer: "Lecturer",
  committee: "Disciplinary Committee",
  student: "Student",
  chair: "Chair (legacy)",
  faculty: "Faculty (legacy)",
  staff: "Staff",
  hod: "HOD (deprecated)",
};

export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "dsa", "dean", "lecturer", "committee", "staff", "student"];

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  matric_number: string | null;
  staff_id: string | null;
  department: string | null;
  faculty: string | null;
  level: string | null;
  phone: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isStaff: boolean;
  hasRole: (r: AppRole) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

// Administration is a separate role — not staff.
const STAFF: AppRole[] = ["admin", "dsa", "dean", "committee", "chair", "staff"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const [{ data: prof }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    setRoles((rs?.map((r: { role: AppRole }) => r.role) ?? []) as AppRole[]);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (session?.user) await loadUserData(session.user.id);
  };

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    // Administration has access to every staff-gated feature.
    isStaff: roles.some((r) => STAFF.includes(r)) || roles.includes("admin"),
    hasRole: (r) => roles.includes(r),
    refresh,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
