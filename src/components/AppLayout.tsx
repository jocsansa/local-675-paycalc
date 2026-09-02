import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calculator, Gauge, HardHat, LogOut, Table2, Zap } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/jobs", label: "Jobs", icon: HardHat },
  { to: "/jobs/new", label: "New Job", icon: Calculator },
  { to: "/quick", label: "Quick", icon: Zap },
  { to: "/rates", label: "Rates", icon: Table2 },
] as const;

/**
 * Signed-in shell. Redirects to /login when there is no session, so every page
 * that renders inside it can assume an authenticated user.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="hatch h-1 w-40 animate-pulse rounded-full opacity-60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="hatch h-6 w-2 rounded-sm" />
            <span className="font-display text-lg font-semibold tracking-wide">
              675 <span className="text-primary">PAYCALC</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(pathname, item.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Mobile tab bar — large touch targets for jobsite use. */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (to === "/jobs") return pathname === "/jobs" || /^\/jobs\/(?!new).+/.test(pathname);
  return pathname.startsWith(to);
}
