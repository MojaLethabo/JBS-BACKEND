import { Router, Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { randomToken } from "../lib/eventWindow.js";
import { qrPngDataUrl, qrPngPublicUrl } from "../lib/qr.js";
import { sendTicketEmail } from "../lib/mail.js";
import { normalizeRegistrationToken } from "../lib/registerToken.js";

const router = Router();

const ORG_TYPES = [
  "Government / Public Sector",
  "SETA",
  "University / Higher Education Institution",
  "TVET College",
  "Private Sector / Industry",
  "NGO / Non-Profit",
  "Research Institution / Think Tank",
  "Entrepreneur / Business Owner",
  "Student",
  "Other",
];

// GET /register/:eventToken — verify link & return required fields
router.get("/:eventToken", async (req: Request, res: Response): Promise<void> => {
  const eventToken = normalizeRegistrationToken(req.params.eventToken);
  if (!eventToken) { res.status(400).json({ ok: false, error: "Missing registration token" }); return; }

  const event = await prisma.event.findUnique({
    where: { eventToken },
    select: { name: true, registrationFields: true },
  });

  if (!event) { res.status(404).json({ ok: false, error: "Invalid or expired registration link" }); return; }

  let registrationFields: string[] = ["name", "surname", "email"];
  try { registrationFields = JSON.parse(event.registrationFields); } catch {}

  res.json({ ok: true, eventName: event.name, registrationFields, organisationTypes: ORG_TYPES });
});

// POST /register — guest registration
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const eventToken = normalizeRegistrationToken(req.body.eventToken);
    const name = String(req.body.name || "").trim();
    const surname = String(req.body.surname || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const mobileNumber = req.body.mobileNumber ? String(req.body.mobileNumber).trim() : undefined;
    const organisation = req.body.organisation ? String(req.body.organisation).trim() : undefined;
    const jobTitle = req.body.jobTitle ? String(req.body.jobTitle).trim() : undefined;
    const location = req.body.location ? String(req.body.location).trim() : undefined;
    const organisationType = req.body.organisationType ? String(req.body.organisationType).trim() : undefined;
    const otherOrgType = req.body.otherOrgType ? String(req.body.otherOrgType).trim() : undefined;

    if (!eventToken || !name || !surname || !email) {
      res.status(400).json({ error: "Required fields are missing" }); return;
    }

    const event = await prisma.event.findUnique({
      where: { eventToken },
      select: { id: true, name: true, startDate: true, durationDays: true, registrationFields: true },
    });

    if (!event) { res.status(404).json({ error: "Invalid or expired registration link" }); return; }

    // Validate required fields from event config
    let requiredFields: string[] = [];
    try { requiredFields = JSON.parse(event.registrationFields); } catch {}

    const fieldMap: Record<string, string | undefined> = {
      mobileNumber, organisation, jobTitle, location, organisationType,
    };
    for (const field of requiredFields) {
      if (!["name", "surname", "email"].includes(field) && !fieldMap[field]) {
        res.status(400).json({ error: `Field '${field}' is required` }); return;
      }
    }

    const qrToken = randomToken(32);

    let guest;
    try {
      guest = await prisma.guest.create({
        data: {
          eventId: event.id, name, surname, email,
          mobileNumber, organisation, jobTitle, location,
          organisationType, otherOrgType, qrToken,
        },
        select: { id: true, name: true, surname: true, email: true },
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
        res.status(409).json({ error: "This email is already registered for this event" }); return;
      }
      throw err;
    }

    const qrDataUrl = await qrPngDataUrl(qrToken);
    const qrPublicUrl = await qrPngPublicUrl(qrToken, guest.id);

    const mail = await sendTicketEmail({
      to: email,
      eventName: event.name,
      startDate: event.startDate,
      durationDays: event.durationDays,
      guestName: `${name} ${surname}`,
      qrDataUrl: qrPublicUrl,
    });

    res.json({ ok: true, guest, emailSent: mail.sent, emailNote: mail.reason, qrDataUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
