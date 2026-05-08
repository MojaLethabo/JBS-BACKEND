import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ORGANIZER_EMAIL || "organizer@example.com";
  const password = process.env.SEED_ORGANIZER_PASSWORD || "changeme123";
  const hash = await bcrypt.hash(password, 10);

  const organizer = await prisma.organizer.upsert({
    where: { email },
    create: { email, passwordHash: hash, name: "Demo Organizer" },
    update: { passwordHash: hash },
  });

  console.log(`Seeded organizer: ${email} / ${password}`);

  const demoToken = process.env.SEED_DEMO_EVENT_TOKEN || "spring-demo-2026";
  await prisma.event.upsert({
    where: { eventToken: demoToken },
    create: {
      name: "Spring Fest 2026",
      eventToken: demoToken,
      startDate: new Date(),
      durationDays: 30,
      organizerId: organizer.id,
    },
    update: {
      name: "Spring Fest 2026",
      durationDays: 30,
    },
  });

  console.log(`Demo event registration URL path: /register/${demoToken}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
