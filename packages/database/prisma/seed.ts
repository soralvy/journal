import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { id: "demo-user" },
    update: {
      email: "demo@example.com",
      username: "demo-user",
      name: "Demo User",
    },
    create: {
      email: "demo@example.com",
      username: "demo-user",
      name: "Demo User",
      id: "demo-user",
    },
  });
  console.log(`Demo user created: ${demoUser.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
