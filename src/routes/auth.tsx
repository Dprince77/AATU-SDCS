import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/aatu-logo.webp.asset.json";
import { MATRIC_HELP, formatMatricInput, isValidMatric } from "@/lib/matric";
import { resolveLoginIdentifier } from "@/lib/auth-lookup.functions";
import { FACULTIES } from "@/lib/faculty";
import { ThemeToggle } from "@/components/theme-toggle";

const PASSWORD_HELP =
  "At least 8 characters with 1 uppercase letter, 1 number, and 1 special character.";
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const PHONE_HELP =
  "Enter your full phone number (10–15 digits, country code optional, e.g. +2348012345678).";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — AATU Disciplinary Committee" },
      {
        name: "description",
        content:
          "Sign in or create an account to access the AATU Student Disciplinary Committee case management workspace.",
      },
      { property: "og:title", content: "Sign in — AATU Disciplinary Committee" },
      {
        property: "og:description",
        content:
          "Sign in or create an account to access the AATU Student Disciplinary Committee case management workspace.",
      },
      { property: "og:url", content: `${process.env.PUBLIC_APP_URL ?? ""}/auth` },
    ],
    links: [{ rel: "canonical", href: `${process.env.PUBLIC_APP_URL ?? ""}/auth` }],
  }),
});

type AuthMode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      <ThemeToggle className="absolute top-4 right-4 z-10" />
      <div className="hidden lg:flex flex-col p-10 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, var(--accent), transparent 40%), radial-gradient(circle at 80% 90%, var(--primary), transparent 50%)",
          }}
        />
        <Link to="/" className="flex items-center gap-4 relative">
          <div className="aatu-crest-ring">
            <img
              src={logoAsset.url}
              alt="AATU Logo"
              className="h-20 w-20 rounded-full bg-card object-contain p-1"
            />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-lg">Abiola Ajimobi</p>
            <p className="font-display font-bold text-lg">Technical University</p>
            <p className="text-xs opacity-70 mt-1">Student Disciplinary Committee</p>
          </div>
        </Link>
        <div className="relative flex-1 flex items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold">
              Fair, transparent, accountable discipline.
            </h2>
            <p className="mt-3 text-sm opacity-80 max-w-md">
              A secure workspace for the Student Disciplinary Committee — built for clarity at every
              stage of a case.
            </p>
          </div>
        </div>
        <p className="text-xs opacity-60 relative">
          © Abiola Ajimobi Technical University · Knowledge · Integrity · Service
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {authMode === "signin" ? (
            <>
              <h1 className="font-display text-2xl font-semibold mb-1">Welcome back</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Sign in to the AATU Case Management workspace.
              </p>
              <SignInForm />
              <p className="text-sm text-muted-foreground text-center mt-6">
                Don't have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  onClick={() => setAuthMode("signup")}
                >
                  Sign up
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold mb-1">Create your account</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Set up access to the AATU Case Management workspace.
              </p>
              <SignUpForm />
              <p className="text-sm text-muted-foreground text-center mt-6">
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  onClick={() => setAuthMode("signin")}
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const [identifier, setIdentifier] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [resetBusy, setResetBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let email = identifier.trim();
    try {
      if (!email.includes("@")) {
        const r = await resolveLoginIdentifier({ data: { identifier: email } });
        email = r.email;
      }
    } catch (err: any) {
      setBusy(false);
      return toast.error(err?.message ?? "Could not find an account for that ID");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return toast.error("Enter your email, matric no, or staff ID first");
    setResetBusy(true);
    let email = identifier.trim();
    try {
      if (!email.includes("@")) {
        const r = await resolveLoginIdentifier({ data: { identifier: email } });
        email = r.email;
      }
    } catch (err: any) {
      setResetBusy(false);
      return toast.error(err?.message ?? "Could not find an account for that ID");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent. Check your email.");
    setMode("signin");
  };

  if (mode === "forgot") {
    return (
      <form onSubmit={forgot} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a link to reset your password.
        </p>
        <div className="space-y-2">
          <Label>Email, Matric No, or Staff ID</Label>
          <Input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={resetBusy}>
          {resetBusy ? "Sending…" : "Send reset link"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
          onClick={() => setMode("signin")}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Button type="button" variant="outline" className="w-full" onClick={google}>
        Continue with Google
      </Button>
      <div className="relative text-center text-xs text-muted-foreground">
        <span className="bg-background px-2 relative z-10">or</span>
        <div className="absolute inset-x-0 top-1/2 border-t" />
      </div>
      <div className="space-y-2">
        <Label>Email, Matric No, or Staff ID</Label>
        <Input
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com, 220/12/3/4567, or staff ID"
        />
      </div>
      <div className="space-y-2">
        <Label>Password</Label>
        <Input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
        onClick={() => setMode("forgot")}
      >
        Forgot your password?
      </button>
    </form>
  );
}

type AccountType = "student" | "staff";

function SignUpForm() {
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    identifier: "",
    phone: "",
    department: "",
    faculty: "",
    level: "",
  });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const navigate = useNavigate();

  const identifierLabel = "Matric No / Reg No / Staff ID";
  const identifierHelp =
    accountType === "student" ? MATRIC_HELP : "Enter your university-issued Staff ID";

  const onIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = accountType === "student" ? formatMatricInput(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, identifier: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = form.identifier.trim();
    if (!id) return toast.error(`${identifierLabel} is required`);
    if (accountType === "student" && !isValidMatric(id)) {
      return toast.error(`Invalid matric number. ${MATRIC_HELP}`);
    }
    if (accountType === "student") {
      if (!form.department.trim()) return toast.error("Department is required");
      if (!form.faculty) return toast.error("Faculty is required");
      if (!form.level.trim()) return toast.error("Level is required");
    }
    const phone = form.phone.replace(/[\s-]/g, "");
    if (!PHONE_REGEX.test(phone)) return toast.error(PHONE_HELP);
    if (!PASSWORD_REGEX.test(form.password)) return toast.error(PASSWORD_HELP);
    setBusy(true);
    const meta: Record<string, string> = {
      full_name: form.full_name,
      phone,
    };
    if (accountType === "student") {
      meta.matric_number = id;
      meta.department = form.department.trim();
      meta.faculty = form.faculty;
      meta.level = form.level.trim();
    } else {
      meta.staff_id = id;
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: meta,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("We sent a verification code to your email.");
    setStep("verify");
  };

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (!/^\d{6}$/.test(token)) return toast.error("Enter the 6-digit code from your email");
    setVerifyBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: form.email, token, type: "signup" });
    setVerifyBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Email verified");
    navigate({ to: "/dashboard" });
  };

  const resend = async () => {
    setResendBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: form.email });
    setResendBusy(false);
    if (error) return toast.error(error.message);
    toast.success("A new code is on its way.");
  };

  if (step === "verify") {
    return (
      <form onSubmit={verify} className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Enter verification code</h2>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium">{form.email}</span>. Enter it
            below to confirm your account.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Verification code</Label>
          <Input
            required
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <p className="text-xs text-muted-foreground">
            Check your inbox (and spam folder) for the code.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={verifyBusy}>
          {verifyBusy ? "Verifying…" : "Verify & continue"}
        </Button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline"
            onClick={() => setStep("form")}
          >
            Back
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            onClick={resend}
            disabled={resendBusy}
          >
            {resendBusy ? "Resending…" : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label>I am a</Label>
        <RadioGroup
          className="grid grid-cols-2 gap-2"
          value={accountType}
          onValueChange={(v) => setAccountType(v as AccountType)}
        >
          <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <RadioGroupItem value="student" /> <span className="text-sm">Student</span>
          </label>
          <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <RadioGroupItem value="staff" /> <span className="text-sm">Staff</span>
          </label>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label>Full name</Label>
        <Input required value={form.full_name} onChange={upd("full_name")} />
      </div>
      <div className="space-y-2">
        <Label>{identifierLabel}</Label>
        <Input
          required
          inputMode={accountType === "student" ? "numeric" : "text"}
          pattern={accountType === "student" ? "\\d{3}/\\d{2}/\\d{1}/\\d{4}" : undefined}
          title={identifierHelp}
          value={form.identifier}
          onChange={onIdChange}
        />
        <p className="text-xs text-muted-foreground">{identifierHelp}</p>
      </div>
      {accountType === "student" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="signup-faculty">Faculty</Label>
            <select
              id="signup-faculty"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.faculty}
              onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
            >
              <option value="">Select your faculty</option>
              {FACULTIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                required
                placeholder="e.g. Computer Science"
                value={form.department}
                onChange={upd("department")}
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Input required placeholder="e.g. 300L" value={form.level} onChange={upd("level")} />
            </div>
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input
          required
          type="tel"
          inputMode="tel"
          placeholder="+2348012345678"
          value={form.phone}
          onChange={upd("phone")}
        />
        <p className="text-xs text-muted-foreground">{PHONE_HELP}</p>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" required value={form.email} onChange={upd("email")} />
      </div>
      <div className="space-y-2">
        <Label>Password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={upd("password")}
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_HELP}</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        {accountType === "student"
          ? "You can update your department and level later from your profile."
          : "Staff roles (DSA, Dean, Lecturer, Committee) are granted by an administrator after signup."}
      </p>
    </form>
  );
}
