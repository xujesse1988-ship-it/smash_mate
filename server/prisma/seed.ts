import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed data will be added here
  console.log('Seed completed'); // eslint-disable-line no-console
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e); // eslint-disable-line no-console
    await prisma.$disconnect();
    process.exit(1);
  });
