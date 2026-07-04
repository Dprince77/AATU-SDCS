import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Files,
  Plus,
  Gavel,
  UserCog,
  LogOut,
  ShieldCheck,
  LifeBuoy,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoAsset from "@/assets/aatu-logo.webp.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="ml-auto"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function AuthLayout() {
  // ALL hooks must be at the top — before any conditional returns
  const { user, loading, profile, isStaff, hasRole, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" />;

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  const isActive = (p: string) => path === p || path.startsWith(p + "/");
  const initials = (profile?.full_name || user.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const canManageStudents = hasRole("admin") || hasRole("dsa") || hasRole("dean");

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/cases", label: "Cases", icon: Files, show: true },
    {
      to: "/cases/new",
      label:
        hasRole("admin") || hasRole("lecturer") || hasRole("dean") || isStaff
          ? "Report incident"
          : "Report someone",
      icon: Plus,
      show: true,
    },
    { to: "/hearings", label: "Hearings", icon: Gavel, show: hasRole("admin") || isStaff },
    { to: "/admin", label: "Administration", icon: ShieldCheck, show: canManageStudents },
    { to: "/profile", label: "My profile", icon: UserCog, show: true },
    { to: "/support", label: "Support", icon: LifeBuoy, show: true },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="aatu-crest-ring shrink-0">
                <img
                  src={logoAsset.url}
                  alt="AATU"
                  className="size-9 rounded-full bg-sidebar object-contain p-0.5"
                />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-display font-semibold text-sm truncate">AATU</span>
                <span className="text-[10px] uppercase tracking-wider opacity-70 truncate">
                  Disciplinary Cases
                </span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items
                    .filter((i) => i.show)
                    .map((i) => (
                      <SidebarMenuItem key={i.to}>
                        <SidebarMenuButton asChild isActive={isActive(i.to)}>
                          <Link to={i.to}>
                            <i.icon />
                            <span>{i.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="size-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-xs font-medium truncate">{profile?.full_name ?? user.email}</p>
                <p className="text-[10px] opacity-70 truncate">
                  {hasRole("admin")
                    ? "Administration"
                    : profile?.matric_number ||
                      profile?.staff_id ||
                      (isStaff ? "Staff" : roles.length ? "Member" : "Student")}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={signOut} title="Sign out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b px-4 bg-card">
            <SidebarTrigger />
            <img src={logoAsset.url} alt="AATU" className="h-8 w-8 object-contain" />
            <div className="text-sm">
              <span className="font-display font-semibold text-primary">
                Abiola Ajimobi Technical University
              </span>
              <span className="text-muted-foreground"> · Student Disciplinary Committee</span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
