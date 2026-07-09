import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getSurahForPage, getJuzForPage } from "./quranPages";

const http = httpRouter();

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * IoT device reports that its physical page counter moved to `page`.
 * POST body: { apiKey: string, page: number, tanggal?: "YYYY-MM-DD" }
 * Logs the read against the device owner's tilawah harian (deduped per day)
 * and updates the shared reading position.
 */
http.route({
  path: "/iot/page-read",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: { apiKey?: string; page?: number; tanggal?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    if (!body.apiKey || typeof body.apiKey !== "string") {
      return json({ error: "missing_api_key" }, 401);
    }
    if (typeof body.page !== "number" || body.page < 1 || body.page > 604) {
      return json({ error: "invalid_page" }, 400);
    }

    const device = await ctx.runQuery(internal.iotDevices.getDeviceByApiKey, {
      apiKey: body.apiKey,
    });
    if (!device) {
      return json({ error: "unauthorized" }, 401);
    }

    const page = Math.round(body.page);
    const { surahNumber, surahName } = getSurahForPage(page);
    const juz = getJuzForPage(page);
    const tanggal = body.tanggal ?? todayISO();

    const result = await ctx.runMutation(internal.mushafProgress.recordPageReadInternal, {
      userId: device.userId,
      page,
      surahNumber,
      surahName,
      juz,
      tanggal,
      source: "iot",
    });
    await ctx.runMutation(internal.iotDevices.touchDevice, { id: device._id });

    return json({ ok: true, page, surahNumber, surahName, juz, duplicate: result.duplicate });
  }),
});

/**
 * IoT device polls for the user's current reading position (e.g. to move a
 * physical indicator to the last page read in the app).
 * GET /iot/position?apiKey=...
 */
http.route({
  path: "/iot/position",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const apiKey = new URL(req.url).searchParams.get("apiKey");
    if (!apiKey) {
      return json({ error: "missing_api_key" }, 401);
    }

    const device = await ctx.runQuery(internal.iotDevices.getDeviceByApiKey, { apiKey });
    if (!device) {
      return json({ error: "unauthorized" }, 401);
    }
    await ctx.runMutation(internal.iotDevices.touchDevice, { id: device._id });

    const position = await ctx.runQuery(api.mushafProgress.getReadingPosition, {
      userId: device.userId,
    });
    return json({ position });
  }),
});

export default http;
