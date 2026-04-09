import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('开始生成 SQL 插入语句...');

  const cities = await prisma.city.findMany();
  const venues = await prisma.venue.findMany();

  let sqlOutput = `-- ======= 城市数据 (City) =======\n`;
  for (const city of cities) {
    const id = city.id;
    const name = city.name.replace(/'/g, "''");
    const createdAt = city.createdAt.toISOString();
    const updatedAt = city.updatedAt.toISOString();
    sqlOutput += `INSERT INTO "City" ("id", "name", "createdAt", "updatedAt") VALUES ('${id}', '${name}', '${createdAt}', '${updatedAt}') ON CONFLICT ("id") DO NOTHING;\n`;
  }

  sqlOutput += `\n-- ======= 球馆数据 (Venue) =======\n`;
  for (const venue of venues) {
    const id = venue.id;
    const name = venue.name.replace(/'/g, "''");
    const address = venue.address.replace(/'/g, "''");
    const lat = venue.latitude;
    const lng = venue.longitude;
    const cityId = venue.cityId;
    const mapPoiId = venue.mapPoiId.replace(/'/g, "''");
    const createdAt = venue.createdAt.toISOString();
    const updatedAt = venue.updatedAt.toISOString();
    
    sqlOutput += `INSERT INTO "Venue" ("id", "name", "address", "latitude", "longitude", "cityId", "mapPoiId", "createdAt", "updatedAt") VALUES ('${id}', '${name}', '${address}', ${lat}, ${lng}, '${cityId}', '${mapPoiId}', '${createdAt}', '${updatedAt}') ON CONFLICT ("id") DO NOTHING;\n`;
  }

  const outputPath = path.join(process.cwd(), 'smash.session.sql');
  fs.writeFileSync(outputPath, sqlOutput, 'utf-8');

  console.log(`✅ 成功生成 SQL 文件：${outputPath}`);
  console.log(`共导出 ${cities.length} 个城市，${venues.length} 个球馆。您可以直接全选这些 SQL 并执行到服务器数据库中。`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect()
  });
