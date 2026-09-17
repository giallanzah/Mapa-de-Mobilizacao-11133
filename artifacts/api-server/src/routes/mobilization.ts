import fs from "node:fs/promises";
import path from "node:path";
import { getAuth } from "@clerk/express";
import {
  CreateChurchIssueReportBody,
  CreateChurchIssueReportParams,
  CreateFlyerReportBody,
  CreateFlyerReportParams,
  ListChurchesQueryParams,
  ListCoordinationFlyerReportsQueryParams,
  UpdateChurchCoordinationBody,
  UpdateChurchCoordinationParams,
  UpdateFlyerReportStatusBody,
  UpdateFlyerReportStatusParams,
} from "@workspace/api-zod";
import { db, churches, flyerReports, issueReports } from "@workspace/db";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";

const router: IRouter = Router();

const markdownPaths = [
  path.resolve(process.cwd(), "src/data/igrejas-evangelicas-df.md"),
  path.resolve(process.cwd(), "artifacts/api-server/src/data/igrejas-evangelicas-df.md"),
];

router.get("/map-config", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ token: process.env.MAPBOX_PUBLIC_TOKEN ?? "" });
});

let seedPromise: Promise<void> | undefined;

function parseCell(value: string) {
  return value.trim().replace(/<br\s*\/?>/gi, " ");
}

function parseLink(value: string) {
  const markdown = value.match(/\]\((https?:\/\/[^)]+)\)/i)?.[1];
  if (markdown) return markdown;
  const raw = parseCell(value);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return null;
}

function parseCoordinates(value: string) {
  const match = parseCell(value).match(
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  );
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -16.2 ||
    latitude > -15.2 ||
    longitude < -48.7 ||
    longitude > -47.2
  ) {
    return null;
  }
  return { latitude, longitude };
}

function isChurchCategory(category: string) {
  const normalized = category.toLowerCase();
  return (
    /(church|evangel|baptist|pentecostal|protestant|presbyterian|assemblies|adventist|congregational|religious_organization)/i.test(
      normalized,
    ) &&
    !/(catholic|jehovah|mormon|spirit|islam|mosque|synagogue)/i.test(normalized)
  );
}

async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: churches.id }).from(churches).limit(1);
      if (existing.length) return;

       let markdown: string | undefined;
       let lastReadError: unknown;
       for (const candidate of markdownPaths) {
         try {
           markdown = await fs.readFile(candidate, "utf8");
           break;
         } catch (error) {
           lastReadError = error;
         }
       }
       if (markdown === undefined) {
         throw lastReadError ?? new Error("Base de igrejas não encontrada.");
       }
      const rows: Array<typeof churches.$inferInsert> = [];
      let regionCode = "RA-I";
      let regionName = "Plano Piloto";
      let rowNumber = 0;

      for (const line of markdown.split("\n")) {
        const heading = line.match(
          /^###\s+\d+\.\s+(.+?)\s+\((RA-[^)]+)\)\s+—/,
        );
        if (heading) {
          regionName = heading[1].trim();
          regionCode = heading[2].trim();
          continue;
        }
        if (!line.startsWith("|") || line.includes("---") || line.includes("Igreja / congregação")) {
          continue;
        }
        const cells = line.split("|").slice(1, -1).map(parseCell);
        if (cells.length < 13 || !isChurchCategory(cells[1])) continue;
        const coordinates = parseCoordinates(cells[8]);
        if (!coordinates) continue;

        rowNumber += 1;
        const mapsUrl =
          parseLink(cells[9]) ??
          `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;
        const sourceId = `${cells[11] || "row"}-${rowNumber}`;
        rows.push({
          name: cells[0],
          category: cells[1],
          regionCode,
          regionName,
          address: cells[2] || null,
          locality: cells[3] || null,
          postalCode: cells[4] || null,
          website: parseLink(cells[5]),
          phone: cells[6] || null,
          socialUrl: parseLink(cells[7]),
          latitude: String(coordinates.latitude),
          longitude: String(coordinates.longitude),
          mapsUrl,
          sourceId,
          flyersConfirmed: 0,
          flyerGoal: 100,
          status: "no_group",
        });
      }

      for (let index = 0; index < rows.length; index += 500) {
        await db
          .insert(churches)
          .values(rows.slice(index, index + 500))
          .onConflictDoNothing();
      }
    })().catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}

function serializeChurch(church: typeof churches.$inferSelect) {
  const flyersConfirmed = church.flyersConfirmed ?? 0;
  const status =
    flyersConfirmed > 0
      ? "action_done"
      : church.whatsappUrl
        ? "group_ready"
        : "no_group";
  return {
    id: church.id,
    name: church.name,
    category: church.category,
    regionCode: church.regionCode,
    regionName: church.regionName,
    address: church.address,
    locality: church.locality,
    postalCode: church.postalCode,
    phone: church.phone,
    website: church.website,
    socialUrl: church.socialUrl,
    latitude: Number(church.latitude),
    longitude: Number(church.longitude),
    mapsUrl: church.mapsUrl,
    whatsappUrl: church.whatsappUrl,
    flyersConfirmed,
    flyerGoal: church.flyerGoal ?? 100,
    status,
  };
}

function requireCoordinator(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({ error: "Acesso restrito à coordenação." });
  }
  return next();
}

router.get("/summary", async (_req, res) => {
  await ensureSeeded();
  const [churchCount, groupedCount, actionCount, flyerCount, pendingCount, regionRows] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(churches),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(churches)
        .where(sql`${churches.whatsappUrl} is not null`),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(churches)
        .where(sql`${churches.flyersConfirmed} > 0`),
      db
        .select({ count: sql<number>`coalesce(sum(${flyerReports.flyerCount}), 0)::int` })
        .from(flyerReports)
        .where(eq(flyerReports.status, "approved")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(flyerReports)
        .where(eq(flyerReports.status, "pending")),
      db
        .select({
          code: churches.regionCode,
          name: churches.regionName,
          churches: sql<number>`count(*)::int`,
        })
        .from(churches)
        .groupBy(churches.regionCode, churches.regionName)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
    ]);

  const regionFlyers = await db
    .select({
      code: churches.regionCode,
      confirmedFlyers: sql<number>`coalesce(sum(case when ${flyerReports.status} = 'approved' then ${flyerReports.flyerCount} else 0 end), 0)::int`,
    })
    .from(churches)
    .leftJoin(flyerReports, eq(flyerReports.churchId, churches.id))
    .groupBy(churches.regionCode);
  const flyerByRegion = new Map(regionFlyers.map((row) => [row.code, row.confirmedFlyers]));

  res.json({
    churches: churchCount[0]?.count ?? 0,
    regions: new Set(regionRows.map((row) => row.code)).size,
    churchesWithGroups: groupedCount[0]?.count ?? 0,
    churchesWithActions: actionCount[0]?.count ?? 0,
    confirmedFlyers: flyerCount[0]?.count ?? 0,
    pendingReports: pendingCount[0]?.count ?? 0,
    topRegions: regionRows.map((row) => ({
      ...row,
      confirmedFlyers: flyerByRegion.get(row.code) ?? 0,
    })),
  });
});

router.get("/regions", async (_req, res) => {
  await ensureSeeded();
  const rows = await db
    .select({
      code: churches.regionCode,
      name: churches.regionName,
      churches: sql<number>`count(*)::int`,
      confirmedFlyers: sql<number>`coalesce(sum(${churches.flyersConfirmed}), 0)::int`,
    })
    .from(churches)
    .groupBy(churches.regionCode, churches.regionName)
    .orderBy(asc(churches.regionName));
  res.json(rows);
});

router.get("/churches", async (req, res) => {
  await ensureSeeded();
  const params = ListChurchesQueryParams.parse(req.query);
  const filters = [];
  if (params.ra) filters.push(eq(churches.regionCode, params.ra));
  if (params.search) {
    filters.push(
      or(
        ilike(churches.name, `%${params.search}%`),
        ilike(churches.address, `%${params.search}%`),
      ),
    );
  }
  if (params.status === "group_ready") filters.push(sql`${churches.whatsappUrl} is not null`);
  if (params.status === "no_group") filters.push(sql`${churches.whatsappUrl} is null`);
  if (params.status === "action_done") filters.push(sql`${churches.flyersConfirmed} > 0`);

  const rows = await db
    .select()
    .from(churches)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(churches.name))
    .limit(params.limit ?? 2500);
  res.json(rows.map(serializeChurch));
});

router.get("/churches/:churchId", async (req, res) => {
  await ensureSeeded();
  const churchId = Number(req.params.churchId);
  const row = await db
    .select()
    .from(churches)
    .where(eq(churches.id, churchId))
    .limit(1);
  if (!row[0]) {
    res.status(404).json({ error: "Igreja não encontrada." });
    return;
  }
  res.json(serializeChurch(row[0]));
});

router.post("/churches/:churchId/flyer-reports", async (req, res) => {
  await ensureSeeded();
  const params = CreateFlyerReportParams.parse(req.params);
  const body = CreateFlyerReportBody.parse(req.body);
  const church = await db
    .select({ id: churches.id, name: churches.name })
    .from(churches)
    .where(eq(churches.id, params.churchId))
    .limit(1);
  if (!church[0]) {
    res.status(404).json({ error: "Igreja não encontrada." });
    return;
  }
  const actionDate =
    body.actionDate instanceof Date
      ? body.actionDate.toISOString().slice(0, 10)
      : body.actionDate;
  const [created] = await db
    .insert(flyerReports)
    .values({
      ...body,
      actionDate,
      churchId: params.churchId,
      status: "pending",
    })
    .returning();
  res.status(201).json({
    ...created,
    churchName: church[0].name,
  });
});

router.post("/churches/:churchId/issue-reports", async (req, res) => {
  await ensureSeeded();
  const params = CreateChurchIssueReportParams.parse(req.params);
  const body = CreateChurchIssueReportBody.parse(req.body);
  const church = await db
    .select({ id: churches.id })
    .from(churches)
    .where(eq(churches.id, params.churchId))
    .limit(1);
  if (!church[0]) {
    res.status(404).json({ error: "Igreja não encontrada." });
    return;
  }
  const [created] = await db
    .insert(issueReports)
    .values({ ...body, churchId: params.churchId, status: "open" })
    .returning();
  res.status(201).json(created);
});

router.get("/coordination/flyer-reports", requireCoordinator, async (req, res) => {
  await ensureSeeded();
  const params = ListCoordinationFlyerReportsQueryParams.parse(req.query);
  const rows = await db
    .select({
      id: flyerReports.id,
      churchId: flyerReports.churchId,
      churchName: churches.name,
      actionDate: flyerReports.actionDate,
      flyerCount: flyerReports.flyerCount,
      volunteerName: flyerReports.volunteerName,
      volunteerPhone: flyerReports.volunteerPhone,
      note: flyerReports.note,
      status: flyerReports.status,
      createdAt: flyerReports.createdAt,
    })
    .from(flyerReports)
    .innerJoin(churches, eq(churches.id, flyerReports.churchId))
    .where(params.status === "all" ? undefined : eq(flyerReports.status, params.status ?? "pending"))
    .orderBy(desc(flyerReports.createdAt));
  res.json(rows);
});

router.patch(
  "/coordination/flyer-reports/:reportId",
  requireCoordinator,
  async (req, res) => {
    const params = UpdateFlyerReportStatusParams.parse(req.params);
    const body = UpdateFlyerReportStatusBody.parse(req.body);
    const [current] = await db
      .select()
      .from(flyerReports)
      .where(eq(flyerReports.id, params.reportId))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const [report] = await tx
        .update(flyerReports)
        .set({ status: body.status })
        .where(eq(flyerReports.id, params.reportId))
        .returning();
      if (current.status !== "approved" && body.status === "approved") {
        await tx
          .update(churches)
          .set({
            flyersConfirmed: sql`${churches.flyersConfirmed} + ${current.flyerCount}`,
            status: "action_done",
          })
          .where(eq(churches.id, current.churchId));
      }
      if (current.status === "approved" && body.status !== "approved") {
        await tx
          .update(churches)
          .set({
            flyersConfirmed: sql`greatest(${churches.flyersConfirmed} - ${current.flyerCount}, 0)`,
          })
          .where(eq(churches.id, current.churchId));
      }
      return report;
    });
    const church = await db
      .select({ name: churches.name })
      .from(churches)
      .where(eq(churches.id, updated.churchId))
      .limit(1);
    res.json({ ...updated, churchName: church[0]?.name ?? "Igreja" });
  },
);

router.patch(
  "/coordination/churches/:churchId",
  requireCoordinator,
  async (req, res) => {
    const params = UpdateChurchCoordinationParams.parse(req.params);
    const body = UpdateChurchCoordinationBody.parse(req.body);
    const [updated] = await db
      .update(churches)
      .set(body)
      .where(eq(churches.id, params.churchId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Igreja não encontrada." });
      return;
    }
    res.json(serializeChurch(updated));
  },
);

export default router;