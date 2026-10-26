/**
 * Creates (or promotes) a SUPER_ADMIN account — use this instead of the demo seed in production.
 *   npm run create-admin -- --email you@example.org --name "Your Name"
 * The password is read from ADMIN_PASSWORD, --password, or asked for interactively.
 */
import { createInterface } from "readline/promises";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    console.error('Usage: npm run create-admin -- --email you@example.org --name "Your Name"');
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD || arg("password");
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 10 characters): ");
    rl.close();
  }
  if (!password || password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }
  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", avatarColor: "#1d4ed8" },
    update: { name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", sessionsValidFrom: new Date() },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "user.create_admin_cli", entityType: "User", entityId: user.id } }).catch(() => {});
  await db.$disconnect();
  console.log(`Super admin ready: ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
