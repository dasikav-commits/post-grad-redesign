/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  try {
    // Find Suranjan Pradeep
    const supervisor = await prisma.supervisorProfile.findFirst({
      where: { name: "Suranjan Pradeep" },
    });

    if (!supervisor) {
      console.log("Supervisor not found");
      return;
    }

    console.log("Found supervisor:", supervisor);

    // Hash the password
    const passwordHash = await bcrypt.hash("12345678", 10);

    // Create user account
    const user = await prisma.portalUser.create({
      data: {
        fullName: supervisor.name,
        email: `${supervisor.name.replace(/\s+/g, ".").toLowerCase()}@supervisor.local`,
        passwordHash,
        role: "SUPERVISOR",
        mustChangePassword: false,
        initialPassword: null,
      },
    });

    console.log("Created user:", user);

    // Link user to supervisor
    await prisma.supervisorProfile.update({
      where: { id: supervisor.id },
      data: { userId: user.id },
    });

    console.log("Successfully linked user to supervisor");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
