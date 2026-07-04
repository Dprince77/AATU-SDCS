import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no filter), not just VITE_* ones
  const env = loadEnv(mode, process.cwd(), "");

  // Inject into the Node process so server functions can read process.env at runtime
  Object.assign(process.env, env);

  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      nitro(),
      react(),
    ],
    define: {
      // Only expose vars that are safe to ship to the client bundle.
      // NEVER put SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET here.
      "process.env.SUPABASE_URL": JSON.stringify(env.SUPABASE_URL),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY),
      "process.env.PUBLIC_APP_URL": JSON.stringify(env.PUBLIC_APP_URL),
      "process.env.LOVABLE_API_KEY": JSON.stringify(env.LOVABLE_API_KEY),
      "process.env.GOOGLE_MAIL_API_KEY": JSON.stringify(env.GOOGLE_MAIL_API_KEY),
    },
  };
});
