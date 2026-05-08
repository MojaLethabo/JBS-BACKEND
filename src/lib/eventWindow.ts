import { randomBytes } from "crypto";

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function eventEndDate(start: Date, durationDays: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + Math.max(0, durationDays - 1));
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isWithinEventWindow(now: Date, start: Date, durationDays: number): boolean {
  const end = eventEndDate(start, durationDays);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  return now >= dayStart && now <= end;
}
