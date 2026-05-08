import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db.js";
import { createSessionToken, verifySessionToken } from "../lib/session.js";
import { randomToken } from "../lib/eventWindow.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/mail.js";

const router = Router();

function frontendUrl(path: string) {
  const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const nameRaw = String(req.body.name || "").trim();

    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    let organizer;
    try {
      organizer = await prisma.organizer.create({
        data: { email, passwordHash, name: nameRaw || null, emailVerified: false },
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
        res.status(409).json({ error: "An account with this email already exists" }); return;
      }
      throw err;
    }

    const token = randomToken(32);
    await prisma.emailVerifyToken.create({
      data: { token, organizerId: organizer.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    sendVerificationEmail({ to: email, name: organizer.name, verifyUrl: frontendUrl(`/verify-email?token=${token}`) })
      .catch((err) => console.error("[sendVerificationEmail /register]", err));

    res.status(201).json({
      ok: true,
      message: "Account created. Please check your email to verify your account.",
      organizer: { id: organizer.id, email: organizer.email, name: organizer.name, emailVerified: false },
    });
  } catch (err) { console.error("[/auth/register]", err); res.status(400).json({ error: "Registration failed" }); }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }

    const organizer = await prisma.organizer.findUnique({ where: { email } });
    if (!organizer || !(await bcrypt.compare(password, organizer.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" }); return;
    }
    if (!organizer.emailVerified) {
      res.status(403).json({ error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" }); return;
    }

    const token = await createSessionToken({ sub: organizer.id, email: organizer.email });
    res.json({ ok: true, token, organizer: { id: organizer.id, email: organizer.email, name: organizer.name, emailVerified: true } });
  } catch { res.status(400).json({ error: "Bad request" }); }
});

router.get("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = await verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    const organizer = await prisma.organizer.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!organizer) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.json({ organizer });
  } catch { res.status(401).json({ error: "Unauthorized" }); }
});

router.post("/verify-email", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.body.token || "").trim();
    if (!token) { res.status(400).json({ error: "Token required" }); return; }

    const record = await prisma.emailVerifyToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: "This verification link is invalid or has expired." }); return;
    }

    await prisma.organizer.update({ where: { id: record.organizerId }, data: { emailVerified: true } });
    await prisma.emailVerifyToken.deleteMany({ where: { organizerId: record.organizerId } });

    const organizer = await prisma.organizer.findUnique({
      where: { id: record.organizerId },
      select: { id: true, email: true, name: true },
    });
    const sessionToken = await createSessionToken({ sub: organizer!.id, email: organizer!.email });
    res.json({ ok: true, token: sessionToken, organizer });
  } catch { res.status(400).json({ error: "Verification failed" }); }
});

router.post("/resend-verification", async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const organizer = await prisma.organizer.findUnique({ where: { email } });
    if (!organizer || organizer.emailVerified) {
      res.json({ ok: true, message: "If that email is registered and unverified, we sent a new link." }); return;
    }
    await prisma.emailVerifyToken.deleteMany({ where: { organizerId: organizer.id } });
    const token = randomToken(32);
    await prisma.emailVerifyToken.create({
      data: { token, organizerId: organizer.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    sendVerificationEmail({ to: email, name: organizer.name, verifyUrl: frontendUrl(`/verify-email?token=${token}`) })
      .catch((err) => console.error("[sendVerificationEmail /resend]", err));
    res.json({ ok: true, message: "Verification email sent. Please check your inbox." });
  } catch (err) { console.error("[/auth/resend-verification]", err); res.status(400).json({ error: "Failed to resend verification email" }); }
});

router.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const organizer = await prisma.organizer.findUnique({ where: { email } });
    if (!organizer) {
      res.json({ ok: true, message: "If that email is registered, a reset link has been sent." }); return;
    }
    await prisma.passwordResetToken.deleteMany({ where: { organizerId: organizer.id } });
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: { token, organizerId: organizer.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    sendPasswordResetEmail({ to: email, name: organizer.name, resetUrl: frontendUrl(`/reset-password?token=${token}`) })
      .catch((err) => console.error("[sendPasswordResetEmail /forgot-password]", err));
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) { console.error("[/auth/forgot-password]", err); res.status(400).json({ error: "Failed to send reset email" }); }
});

router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");
    if (!token || !password) { res.status(400).json({ error: "Token and new password are required" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      res.status(400).json({ error: "This reset link is invalid or has expired." }); return;
    }

    await prisma.organizer.update({
      where: { id: record.organizerId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } });
    res.json({ ok: true, message: "Password updated successfully. You can now log in." });
  } catch { res.status(400).json({ error: "Password reset failed" }); }
});

export default router;
