import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/auth";

const appRoleSchema = z.enum([
  "admin", "dsa", "dean", "lecturer", "committee", "chair", "staff", "student",
]);

const addRoleSchema = z.object({
  userId: z.string().uuid(),
  role: appRoleSchema,
  faculty: z.string().optional(),
});

const removeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: appRoleSchema,
});

/** Assigns a role to a user. Caller must be admin (enforced server-side). */
export const addUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => addRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the calling user is an admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    // Use the admin client (bypasses RLS) to insert the role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: { user_id: string; role: AppRole; faculty?: string } =
      data.role === "dean" && data.faculty
        ? { user_id: data.userId, role: data.role, faculty: data.faculty }
        : { user_id: data.userId, role: data.role };

    const { error } = await supabaseAdmin.from("user_roles").insert(payload);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Removes a role from a user. Caller must be admin. The "admin" role is protected. */
export const removeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => removeRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.role === "admin") {
      throw new Error("The Administration role is protected and can only be changed in the database.");
    }

    // Verify caller is admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);

    if (error) throw new Error(error.message);

    return { ok: true };
  });
