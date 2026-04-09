import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('开始导出数据...');

  const cities = await prisma.city.findMany();
  const venues = await prisma.venue.findMany();

  const data = {
    cities,
    venues,
  };

  const outputPath = path.join(process.cwd(), 'venue_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`✅ 成功导出 ${cities.length} 个城市和 ${venues.length} 个球馆。`);
  console.log(`数据已保存至 ${outputPath}`);
}

main()
  .catch((e) => {
    console.error('导出失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
