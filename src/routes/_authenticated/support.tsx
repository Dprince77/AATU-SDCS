import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { sendSupportMessageFn } from "@/lib/email/notify.functions";

export const Route = createFileRoute("/_authenticated/support")({
  ssr: false,
  component: SupportPage,
});

const SUPPORT_EMAIL = "yusufoyedele7@gmail.com";

function SupportPage() {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    subject: "",
    category: "Website issue",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const sendSupportMessage = useServerFn(sendSupportMessageFn);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      return toast.error("Please fill in the subject and message");
    }
    setBusy(true);
    try {
      const result = await sendSupportMessage({
        data: {
          subject: form.subject,
          category: form.category,
          message: form.message,
          senderName: profile?.full_name ?? "",
          senderEmail: user?.email ?? "",
          senderId: profile?.matric_number ?? profile?.staff_id ?? "",
        },
      });
      if (!result.ok) {
        toast.error("Couldn't send your message. Please try again or email us directly.");
      } else {
        toast.success("Sent! Our team will get back to you by email.");
        setForm({ subject: "", category: "Website issue", message: "" });
      }
    } catch (err) {
      console.error("sendSupportMessage failed", err);
      toast.error("Couldn't send your message. Please try again or email us directly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <LifeBuoy className="size-7 text-primary" /> Support
        </h1>
        <p className="text-muted-foreground mt-1">
          Report any complaint or issue you are experiencing with this website. Our team will reply
          to your registered email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Contact the team</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Website issue</option>
                <option>Account / sign-in problem</option>
                <option>Case or hearing concern</option>
                <option>Suggestion</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Short summary"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Describe the issue</Label>
              <Textarea
                rows={6}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="What were you trying to do? What happened?"
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                <Mail /> {busy ? "Sending…" : "Send to support"}
              </Button>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-primary underline">
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
