import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Caller must be admin
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Response("Forbidden", { status: 403 });
    if (data.userId === userId) {
      throw new Error("You cannot delete your own account");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove dependent profile + roles rows first (FKs to auth.users use cascade,
    // but we delete explicitly so policies/triggers don't block anything else).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });