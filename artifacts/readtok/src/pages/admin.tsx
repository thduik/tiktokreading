import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, LogOut, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchAdminReports,
  fetchAdminSession,
  loginAdmin,
  logoutAdmin,
  type AdminReportItem,
  type AdminReportsResponse,
  type AdminSession,
} from "@/lib/admin-api";

const reportTypeLabels: Record<string, string> = {
  wrong_answer_key: "Answer key",
  question_unclear: "Unclear",
  questions_too_easy: "Too easy",
  passage_text_issue: "Passage text",
  formatting_issue: "Formatting",
  other: "Other",
};

function formatReportType(value: string) {
  return reportTypeLabels[value] ?? value.replace(/_/g, " ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportChips({ item }: { item: AdminReportItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.reports.map((report) => (
        <span
          key={report.report_type}
          className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
        >
          {formatReportType(report.report_type)}:{" "}
          <span className="font-semibold text-primary">{report.count}</span>
        </span>
      ))}
    </div>
  );
}

function AdminLogin({
  configured,
  onLoggedIn,
}: {
  configured: boolean;
  onLoggedIn: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await loginAdmin({ username, password });
      onLoggedIn(response.username);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-start justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Admin</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Passage report control room.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Admin login is not configured on the server.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="admin-username">
                  Username
                </label>
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="h-11 bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="admin-password">
                  Password
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-11 bg-muted"
                />
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [reports, setReports] = useState<AdminReportsResponse | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topItems = useMemo(() => reports?.items ?? [], [reports]);

  async function loadReports() {
    setIsLoadingReports(true);
    setError(null);
    try {
      setReports(await fetchAdminReports());
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Could not load reports");
      if (reportError instanceof Error && reportError.message.includes("401")) {
        setSession((current) =>
          current ? { ...current, authenticated: false, username: null } : current,
        );
      }
    } finally {
      setIsLoadingReports(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setIsLoadingSession(true);
      try {
        const nextSession = await fetchAdminSession();
        if (cancelled) {
          return;
        }
        setSession(nextSession);
        if (nextSession.authenticated) {
          await loadReports();
        }
      } catch (sessionError) {
        if (!cancelled) {
          setError(sessionError instanceof Error ? sessionError.message : "Could not load admin session");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSession(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logoutAdmin();
    setReports(null);
    setSession((current) =>
      current ? { ...current, authenticated: false, username: null } : current,
    );
  }

  if (isLoadingSession) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Loading admin...
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <AdminLogin
        configured={session?.configured ?? false}
        onLoggedIn={(username) => {
          setSession({ configured: true, authenticated: true, username });
          void loadReports();
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Shield className="h-4 w-4" />
              Admin
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-normal md:text-3xl">
              Passage Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {session.username}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReports()}
              disabled={isLoadingReports}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Reported passages</p>
              <p className="mt-2 text-2xl font-bold">
                {reports?.summary.reported_passage_count ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Total reports</p>
              <p className="mt-2 text-2xl font-bold">
                {reports?.summary.total_report_count ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Visible rows</p>
              <p className="mt-2 text-2xl font-bold">{topItems.length}</p>
            </CardContent>
          </Card>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <Card className="border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%] px-4">Passage</TableHead>
                  <TableHead>Reports</TableHead>
                  <TableHead className="w-[90px]">Total</TableHead>
                  <TableHead className="w-[130px]">Latest</TableHead>
                  <TableHead className="w-[90px] text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingReports ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                      Loading reports...
                    </TableCell>
                  </TableRow>
                ) : topItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                      No passage reports yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  topItems.map((item) => (
                    <TableRow key={item.passage_id}>
                      <TableCell className="px-4">
                        <div className="font-semibold text-foreground">{item.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.band_label} · {item.question_set_type_label} · {item.factory_tag} · {item.status}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {item.passage_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ReportChips item={item} />
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {item.total_count}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.latest_reported_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <a href={`/?start=${encodeURIComponent(item.passage_id)}`}>
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
