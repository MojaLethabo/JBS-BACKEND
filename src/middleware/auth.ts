import { Request, Response, NextFunction } from "express";
import { verifySessionToken } from "../lib/session.js";
import { prisma } from "../lib/db.js";

export interface AuthedRequest extends Request {
  organizerId: string;
  organizerEmail: string;
}

export async function requireOrganizer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    const payload = await verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

    // Only select the two fields we actually need — faster than SELECT *
    const organizer = await prisma.organizer.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    if (!organizer) { res.status(401).json({ error: "Unauthorized" }); return; }

    (req as AuthedRequest).organizerId = organizer.id;
    (req as AuthedRequest).organizerEmail = organizer.email;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
