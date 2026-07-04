import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ identifier: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const id = data.identifier.trim();
    if (id.includes("@")) return { email: id };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .or(`matric_number.eq.${id},staff_id.eq.${id}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.email) throw new Error("No account found for that ID");
    return { email: row.email };
  });