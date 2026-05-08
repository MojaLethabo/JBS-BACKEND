import { Router, Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { requireOrganizer, AuthedRequest } from "../middleware/auth.js";
import { isWithinEventWindow } from "../lib/eventWindow.js";

const router = Router();

router.post("/", requireOrganizer, async (req: Request, res: Response): Promise<void> => {
  const { organizerId } = req as AuthedRequest;

  try {
    const eventId = String(req.body.eventId || "").trim();
    const qrToken = String(req.body.qrToken || "").trim();

    if (!eventId || !qrToken) {
      res.status(400).json({ error: "Missing event or token" }); return;
    }

    // Single query: fetch event + matching guest together
    // This avoids two separate round-trips to the DB
    const [event, guest] = await Promise.all([
      prisma.event.findFirst({
        where: { id: eventId, organizerId },
        select: { id: true, startDate: true, durationDays: true },
      }),
      prisma.guest.findUnique({
        where: { qrToken },
        select: { id: true, name: true, surname: true, eventId: true, checkedInAt: true },
      }),
    ]);

    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    if (!isWithinEventWindow(new Date(), event.startDate, event.durationDays)) {
      res.json({ ok: false, code: "EVENT_WINDOW", message: "Check-in is only allowed during the event date range" });
      return;
    }

    if (!guest) {
      res.json({ ok: false, code: "UNKNOWN_QR", message: "QR code not recognized" });
      return;
    }

    if (guest.eventId !== event.id) {
      res.json({ ok: false, code: "WRONG_EVENT", message: "This ticket is for a different event" });
      return;
    }

    if (guest.checkedInAt) {
      res.json({
        ok: false,
        code: "ALREADY_USED",
        message: "Already checked in",
        checkedInAt: guest.checkedInAt.toISOString(),
      });
      return;
    }

    // Atomic update — only succeeds if not already checked in
    const now = new Date();
    const updated = await prisma.guest.update({
      where: {
        id: guest.id,
        checkedInAt: null, // guard: prevent double check-in under race condition
      },
      data: { checkedInAt: now },
      select: { name: true, surname: true, checkedInAt: true },
    });

    res.json({
      ok: true,
      message: "Check-in successful",
      guest: {
        name: updated.name,
        surname: updated.surname,
        checkedInAt: updated.checkedInAt!.toISOString(),
      },
    });
  } catch (e: unknown) {
    // Prisma throws P2025 if the where.checkedInAt: null guard fails (race condition)
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2025") {
      res.json({ ok: false, code: "ALREADY_USED", message: "Already checked in" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Check-in failed" });
  }
});

export default router;
