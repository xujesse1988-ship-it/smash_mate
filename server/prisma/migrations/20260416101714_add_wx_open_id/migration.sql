-- AlterTable
ALTER TABLE "User" ADD COLUMN     "wx_open_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_wx_open_id_key" ON "User"("wx_open_id");
