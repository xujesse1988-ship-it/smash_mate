import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const inputPath = path.join(process.cwd(), 'venue_data.json');
  
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 未找到数据文件：${inputPath}`);
    console.error('请先运行 npx tsx scripts/export-venues.ts 生成数据，并确保文件在正确位置。');
    process.exit(1);
  }

  console.log('开始导入数据...');
  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(fileContent);

  const { cities, venues } = data;

  if (cities && cities.length > 0) {
    console.log(`正在导入 ${cities.length} 个城市...`);
    await prisma.city.createMany({
      data: cities,
      skipDuplicates: true, // 忽略主键已存在的记录
    });
  }

  if (venues && venues.length > 0) {
    console.log(`正在导入 ${venues.length} 个球馆...`);
    await prisma.venue.createMany({
      data: venues,
      skipDuplicates: true,
    });
  }

  console.log('✅ 数据导入完成！');
}

main()
  .catch((e) => {
    console.error('导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
