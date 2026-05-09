import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  passageReportCounts,
  passages,
} from "@workspace/db";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  readAdminAuthConfig,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "../lib/admin-auth";

const router: IRouter = Router();
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function adminCookieIsSecure() {
  if (process.env.ADMIN_COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function readAdminSession(req: Request) {
  const config = readAdminAuthConfig(process.env);
  if (!config) {
    return { config: null, session: null };
  }

  const token =
    typeof req.cookies?.[ADMIN_SESSION_COOKIE] === "string"
      ? req.cookies[ADMIN_SESSION_COOKIE]
      : undefined;

  return {
    config,
    session: verifyAdminSessionToken({ config, token }),
  };
}

function requireAdmin(req: Request, res: Response) {
  const { config, session } = readAdminSession(req);
  if (!config) {
    res.status(503).json({ error: "Admin login is not configured" });
    return null;
  }

  if (!session) {
    res.status(401).json({ error: "Admin login required" });
    return null;
  }

  return { config, session };
}

function setAdminCookie(res: Response, token: string) {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieIsSecure(),
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

function clearAdminCookie(res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieIsSecure(),
    path: "/",
  });
}

router.get("/admin/session", (req, res) => {
  const { config, session } = readAdminSession(req);
  if (!config) {
    res.json({ configured: false, authenticated: false, username: null });
    return;
  }

  res.json({
    configured: true,
    authenticated: Boolean(session),
    username: session?.username ?? null,
  });
});

router.post("/admin/login", (req, res) => {
  const config = readAdminAuthConfig(process.env);
  if (!config) {
    res.status(503).json({ error: "Admin login is not configured" });
    return;
  }

  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!verifyAdminCredentials({ config, username, password })) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  setAdminCookie(res, createAdminSessionToken({ config }));
  res.json({ ok: true, username: config.username });
});

router.post("/admin/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/admin/reports", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const limitRaw = Number(req.query.limit ?? 200);
  const limit = Number.isInteger(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 500)
    : 200;

  const rows = await db
    .select({
      passageId: passages.id,
      title: passages.title,
      bandLabel: passages.bandLabel,
      questionSetTypeLabel: passages.questionSetTypeLabel,
      factoryTag: passages.factoryTag,
      status: passages.status,
      reportType: passageReportCounts.reportType,
      count: passageReportCounts.count,
      updatedAt: passageReportCounts.updatedAt,
    })
    .from(passageReportCounts)
    .innerJoin(passages, eq(passages.id, passageReportCounts.passageId))
    .orderBy(desc(passageReportCounts.updatedAt));

  const reportsByPassage = new Map<
    string,
    {
      passage_id: string;
      title: string;
      band_label: string;
      question_set_type_label: string;
      factory_tag: string;
      status: string;
      total_count: number;
      latest_reported_at: string;
      reports: Array<{
        report_type: string;
        count: number;
        updated_at: string;
      }>;
    }
  >();

  for (const row of rows) {
    const latestReportedAt = row.updatedAt.toISOString();
    const current =
      reportsByPassage.get(row.passageId) ??
      {
        passage_id: row.passageId,
        title: row.title,
        band_label: row.bandLabel,
        question_set_type_label: row.questionSetTypeLabel,
        factory_tag: row.factoryTag,
        status: row.status,
        total_count: 0,
        latest_reported_at: latestReportedAt,
        reports: [],
      };

    current.total_count += row.count;
    if (latestReportedAt > current.latest_reported_at) {
      current.latest_reported_at = latestReportedAt;
    }
    current.reports.push({
      report_type: row.reportType,
      count: row.count,
      updated_at: latestReportedAt,
    });
    reportsByPassage.set(row.passageId, current);
  }

  const allItems = [...reportsByPassage.values()];
  const items = allItems
    .sort((left, right) => {
      if (right.total_count !== left.total_count) {
        return right.total_count - left.total_count;
      }
      return right.latest_reported_at.localeCompare(left.latest_reported_at);
    })
    .slice(0, limit);

  res.json({
    items,
    summary: {
      reported_passage_count: reportsByPassage.size,
      total_report_count: allItems.reduce((sum, item) => sum + item.total_count, 0),
    },
  });
});

export default router;
