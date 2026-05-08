import { Router, Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { requireOrganizer, AuthedRequest } from "../middleware/auth.js";
import { randomToken } from "../lib/eventWindow.js";

const router = Router();

// GET /events
router.get("/", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;
  const base = process.env.APP_BASE_URL || "";

  const events = await prisma.event.findMany({
    where: { organizerId },
    orderBy: { startDate: "desc" },
    select: {
      id: true, name: true, eventToken: true, startDate: true, durationDays: true, registrationFields: true,
      _count: { select: { guests: true } },
    },
  });

  res.json({
    events: events.map((e) => ({
      id: e.id, name: e.name, eventToken: e.eventToken,
      startDate: e.startDate.toISOString(), durationDays: e.durationDays,
      guestCount: e._count.guests,
      registrationFields: (() => { try { return JSON.parse(e.registrationFields); } catch { return []; } })(),
      registrationUrl: `${base}/register/${e.eventToken}`,
    })),
  });
});

// POST /events
router.post("/", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;
  const base = process.env.APP_BASE_URL || "";

  try {
    const name = String(req.body.name || "").trim();
    const startDateRaw = req.body.startDate;
    const durationDays = Number(req.body.durationDays);
    const registrationFields = Array.isArray(req.body.registrationFields)
      ? req.body.registrationFields
      : ["name", "surname", "email"];

    if (!name || !startDateRaw || !Number.isFinite(durationDays) || durationDays < 1) {
      res.status(400).json({ error: "Invalid event data" }); return;
    }
    const startDate = new Date(startDateRaw);
    if (Number.isNaN(startDate.getTime())) {
      res.status(400).json({ error: "Invalid start date" }); return;
    }

    const event = await prisma.event.create({
      data: {
        name, startDate, durationDays: Math.floor(durationDays),
        eventToken: randomToken(18), organizerId,
        registrationFields: JSON.stringify(registrationFields),
      },
      select: { id: true, name: true, eventToken: true, startDate: true, durationDays: true, registrationFields: true },
    });

    res.status(201).json({
      event: {
        ...event,
        startDate: event.startDate.toISOString(),
        guestCount: 0,
        registrationFields: (() => { try { return JSON.parse(event.registrationFields); } catch { return []; } })(),
        registrationUrl: `${base}/register/${event.eventToken}`,
      },
    });
  } catch {
    res.status(400).json({ error: "Bad request" });
  }
});

// GET /events/:id — detail + guest list
router.get("/:id", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;
  const base = process.env.APP_BASE_URL || "";

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizerId },
    select: {
      id: true, name: true, eventToken: true, startDate: true, durationDays: true, registrationFields: true,
      guests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, surname: true, email: true,
          mobileNumber: true, organisation: true, jobTitle: true,
          location: true, organisationType: true, otherOrgType: true,
          checkedInAt: true, createdAt: true,
        },
      },
    },
  });

  if (!event) { res.status(404).json({ error: "Not found" }); return; }

  const totalGuests = event.guests.length;
  const checkedIn = event.guests.filter((g) => g.checkedInAt !== null).length;

  res.json({
    event: {
      id: event.id, name: event.name, eventToken: event.eventToken,
      startDate: event.startDate.toISOString(), durationDays: event.durationDays,
      registrationFields: (() => { try { return JSON.parse(event.registrationFields); } catch { return []; } })(),
      registrationUrl: `${base}/register/${event.eventToken}`,
      stats: { totalGuests, checkedIn },
      guests: event.guests.map((g) => ({
        id: g.id, name: g.name, surname: g.surname, email: g.email,
        mobileNumber: g.mobileNumber ?? null,
        organisation: g.organisation ?? null,
        jobTitle: g.jobTitle ?? null,
        location: g.location ?? null,
        organisationType: g.organisationType ?? null,
        otherOrgType: g.otherOrgType ?? null,
        checkedInAt: g.checkedInAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
      })),
    },
  });
});

// PATCH /events/:id — update registration fields
router.patch("/:id", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;

  try {
    const event = await prisma.event.findFirst({ where: { id: req.params.id, organizerId } });
    if (!event) { res.status(404).json({ error: "Not found" }); return; }

    const updateData: Record<string, unknown> = {};
    if (req.body.name) updateData.name = String(req.body.name).trim();
    if (Array.isArray(req.body.registrationFields)) {
      updateData.registrationFields = JSON.stringify(req.body.registrationFields);
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, registrationFields: true },
    });

    res.json({ ok: true, event: { ...updated, registrationFields: JSON.parse(updated.registrationFields) } });
  } catch {
    res.status(400).json({ error: "Bad request" });
  }
});

// GET /events/:id/insights — per-event stats (named to avoid ad blocker blocks on /analytics/)
router.get("/:id/insights", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizerId },
    select: {
      id: true, name: true,
      guests: {
        select: {
          organisationType: true, otherOrgType: true,
          checkedInAt: true, createdAt: true,
        },
      },
    },
  });

  if (!event) { res.status(404).json({ error: "Not found" }); return; }

  // Aggregate by org type
  const orgTypeCounts: Record<string, number> = {};
  const orgTypeCheckedIn: Record<string, number> = {};
  for (const g of event.guests) {
    const type = g.organisationType || "Not specified";
    orgTypeCounts[type] = (orgTypeCounts[type] || 0) + 1;
    if (g.checkedInAt) orgTypeCheckedIn[type] = (orgTypeCheckedIn[type] || 0) + 1;
  }

  // Registrations per day
  const regPerDay: Record<string, number> = {};
  for (const g of event.guests) {
    const day = g.createdAt.toISOString().split("T")[0];
    regPerDay[day] = (regPerDay[day] || 0) + 1;
  }

  res.json({
    ok: true,
    analytics: {
      totalGuests: event.guests.length,
      checkedIn: event.guests.filter((g) => g.checkedInAt).length,
      byOrgType: Object.entries(orgTypeCounts).map(([type, count]) => ({
        type, count, checkedIn: orgTypeCheckedIn[type] || 0,
      })),
      registrationsPerDay: Object.entries(regPerDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    },
  });
});

// GET /events/insights/summary — cross-event stats (named to avoid ad blocker blocks on /analytics/)
router.get("/insights/summary", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;
  const { eventId, orgType } = req.query;

  const where: Record<string, unknown> = { organizerId };
  if (eventId) where.id = String(eventId);

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true, name: true,
      guests: {
        where: orgType ? { organisationType: String(orgType) } : undefined,
        select: { organisationType: true, checkedInAt: true, createdAt: true },
      },
    },
  });

  const summary = events.map((ev) => {
    const orgTypeCounts: Record<string, number> = {};
    for (const g of ev.guests) {
      const t = g.organisationType || "Not specified";
      orgTypeCounts[t] = (orgTypeCounts[t] || 0) + 1;
    }
    return {
      eventId: ev.id, eventName: ev.name,
      totalGuests: ev.guests.length,
      checkedIn: ev.guests.filter((g) => g.checkedInAt).length,
      byOrgType: orgTypeCounts,
    };
  });

  res.json({ ok: true, summary });
});

export default router;
