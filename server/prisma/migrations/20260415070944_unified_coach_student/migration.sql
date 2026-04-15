/*
  Warnings:

  - You are about to drop the column `slotId` on the `PrivateLesson` table. All the data in the column will be lost.
  - You are about to drop the `PrivateLessonSlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PrivateLesson" DROP CONSTRAINT "PrivateLesson_slotId_fkey";

-- DropForeignKey
ALTER TABLE "PrivateLesson" DROP CONSTRAINT "PrivateLesson_studentId_fkey";

-- DropForeignKey
ALTER TABLE "PrivateLessonSlot" DROP CONSTRAINT "PrivateLessonSlot_coachId_fkey";

-- DropIndex
DROP INDEX "PrivateLesson_coachId_idx";

-- DropIndex
DROP INDEX "PrivateLesson_slotId_key";

-- DropIndex
DROP INDEX "PrivateLesson_status_endTime_idx";

-- DropIndex
DROP INDEX "PrivateLesson_status_idx";

-- DropIndex
DROP INDEX "PrivateLesson_studentId_idx";

-- AlterTable
ALTER TABLE "PrivateLesson" DROP COLUMN "slotId",
ADD COLUMN     "feeDescription" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "trainingContent" TEXT,
ADD COLUMN     "venueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "studentId" DROP NOT NULL;

-- DropTable
DROP TABLE "PrivateLessonSlot";

-- CreateTable
CREATE TABLE "CoachApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificateUrls" TEXT[],
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentClass" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentClassMember" (
    "id" TEXT NOT NULL,
    "studentClassId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentClassMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLesson" (
    "id" TEXT NOT NULL,
    "studentClassId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "venueId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "trainingContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachStudent" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "firstMetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonNote" (
    "id" TEXT NOT NULL,
    "classLessonId" TEXT,
    "privateLessonId" TEXT,
    "coachId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentClassId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTag" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachApplication_userId_idx" ON "CoachApplication"("userId");

-- CreateIndex
CREATE INDEX "CoachApplication_status_idx" ON "CoachApplication"("status");

-- CreateIndex
CREATE INDEX "CoachApplication_status_createdAt_idx" ON "CoachApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentClass_coachId_idx" ON "StudentClass"("coachId");

-- CreateIndex
CREATE INDEX "StudentClassMember_studentId_idx" ON "StudentClassMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentClassMember_studentClassId_studentId_key" ON "StudentClassMember"("studentClassId", "studentId");

-- CreateIndex
CREATE INDEX "ClassLesson_studentClassId_idx" ON "ClassLesson"("studentClassId");

-- CreateIndex
CREATE INDEX "ClassLesson_coachId_idx" ON "ClassLesson"("coachId");

-- CreateIndex
CREATE INDEX "ClassLesson_status_idx" ON "ClassLesson"("status");

-- CreateIndex
CREATE INDEX "ClassLesson_status_startTime_idx" ON "ClassLesson"("status", "startTime");

-- CreateIndex
CREATE INDEX "ClassLesson_status_endTime_idx" ON "ClassLesson"("status", "endTime");

-- CreateIndex
CREATE INDEX "ClassLesson_venueId_idx" ON "ClassLesson"("venueId");

-- CreateIndex
CREATE INDEX "CoachStudent_coachId_idx" ON "CoachStudent"("coachId");

-- CreateIndex
CREATE INDEX "CoachStudent_studentId_idx" ON "CoachStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachStudent_coachId_studentId_key" ON "CoachStudent"("coachId", "studentId");

-- CreateIndex
CREATE INDEX "LessonNote_classLessonId_idx" ON "LessonNote"("classLessonId");

-- CreateIndex
CREATE INDEX "LessonNote_privateLessonId_idx" ON "LessonNote"("privateLessonId");

-- CreateIndex
CREATE INDEX "LessonNote_coachId_idx" ON "LessonNote"("coachId");

-- CreateIndex
CREATE INDEX "StudentNote_coachId_studentId_idx" ON "StudentNote"("coachId", "studentId");

-- CreateIndex
CREATE INDEX "StudentNote_studentClassId_idx" ON "StudentNote"("studentClassId");

-- CreateIndex
CREATE INDEX "StudentTag_coachId_studentId_idx" ON "StudentTag"("coachId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTag_coachId_studentId_tag_key" ON "StudentTag"("coachId", "studentId", "tag");

-- CreateIndex
CREATE INDEX "PrivateLesson_coachId_status_idx" ON "PrivateLesson"("coachId", "status");

-- CreateIndex
CREATE INDEX "PrivateLesson_studentId_status_idx" ON "PrivateLesson"("studentId", "status");

-- CreateIndex
CREATE INDEX "PrivateLesson_coachId_studentId_idx" ON "PrivateLesson"("coachId", "studentId");

-- AddForeignKey
ALTER TABLE "PrivateLesson" ADD CONSTRAINT "PrivateLesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachApplication" ADD CONSTRAINT "CoachApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClass" ADD CONSTRAINT "StudentClass_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassMember" ADD CONSTRAINT "StudentClassMember_studentClassId_fkey" FOREIGN KEY ("studentClassId") REFERENCES "StudentClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassMember" ADD CONSTRAINT "StudentClassMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_studentClassId_fkey" FOREIGN KEY ("studentClassId") REFERENCES "StudentClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLesson" ADD CONSTRAINT "ClassLesson_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachStudent" ADD CONSTRAINT "CoachStudent_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachStudent" ADD CONSTRAINT "CoachStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_classLessonId_fkey" FOREIGN KEY ("classLessonId") REFERENCES "ClassLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_privateLessonId_fkey" FOREIGN KEY ("privateLessonId") REFERENCES "PrivateLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTag" ADD CONSTRAINT "StudentTag_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTag" ADD CONSTRAINT "StudentTag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
