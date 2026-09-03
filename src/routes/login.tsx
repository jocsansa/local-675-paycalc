import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  async function handle(mode: "in" | "up") {
    if (!email || !password) {
      toast.error("Enter an email and a password.");
      return;
    }
    setBusy(true);
    const error =
      mode === "in" ? await signIn(email, password) : await signUp(email, password, displayName);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === "up") {
      toast.success("Account created. If confirmation is on, check your email, then sign in.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="hatch mx-auto mb-4 h-2 w-24 rounded-full" />
          <h1 className="font-display text-3xl font-bold tracking-wide">
            675 <span className="text-primary">PAYCALC</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Piecework calculation for drywall &amp; boarding.
          </p>
        </div>

        <div className="panel p-5">
          <Tabs defaultValue="in">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="in" className="mt-5 space-y-4">
              <Field id="email-in" label="Email">
                <Input
                  id="email-in"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field id="pw-in" label="Password">
                <Input
                  id="pw-in"
                  type="password"
                  autoComplete="current-password"
                  className="h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button
                className="h-12 w-full text-base"
                disabled={busy}
                onClick={() => void handle("in")}
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="up" className="mt-5 space-y-4">
              <Field id="name-up" label="Name">
                <Input
                  id="name-up"
                  className="h-12"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
              <Field id="email-up" label="Email">
                <Input
                  id="email-up"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field id="pw-up" label="Password">
                <Input
                  id="pw-up"
                  type="password"
                  autoComplete="new-password"
                  className="h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button
                className="h-12 w-full text-base"
                disabled={busy}
                onClick={() => void handle("up")}
              >
                {busy ? "Creating…" : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Only the first account on a new deployment becomes an admin. Every later account
                signs in with no role until an admin grants one.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
