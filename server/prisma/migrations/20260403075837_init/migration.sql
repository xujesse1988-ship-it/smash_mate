-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isCoach" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneLock" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "cityId" TEXT NOT NULL,
    "mapPoiId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "venueId" TEXT,
    "title" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupClass" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "venueId" TEXT,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "feeDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupClassEnrollment" (
    "id" TEXT NOT NULL,
    "groupClassId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateLessonSlot" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "venueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feeDescription" TEXT,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateLessonSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateLesson" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "venueId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRecord" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchRecordId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPlayer" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchGame" (
    "id" TEXT NOT NULL,
    "matchRecordId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,

    CONSTRAINT "MatchGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "courseType" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "VerificationCode_phone_createdAt_idx" ON "VerificationCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneLock_phone_key" ON "PhoneLock"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_mapPoiId_key" ON "Venue"("mapPoiId");

-- CreateIndex
CREATE INDEX "Venue_cityId_idx" ON "Venue"("cityId");

-- CreateIndex
CREATE INDEX "Venue_name_idx" ON "Venue"("name");

-- CreateIndex
CREATE INDEX "Venue_latitude_longitude_idx" ON "Venue"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Activity_creatorId_idx" ON "Activity"("creatorId");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_startTime_idx" ON "Activity"("startTime");

-- CreateIndex
CREATE INDEX "Activity_venueId_idx" ON "Activity"("venueId");

-- CreateIndex
CREATE INDEX "Activity_status_startTime_idx" ON "Activity"("status", "startTime");

-- CreateIndex
CREATE INDEX "Activity_status_endTime_idx" ON "Activity"("status", "endTime");

-- CreateIndex
CREATE INDEX "ActivityParticipant_userId_idx" ON "ActivityParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_activityId_userId_key" ON "ActivityParticipant"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_userId_key" ON "CoachProfile"("userId");

-- CreateIndex
CREATE INDEX "GroupClass_coachId_idx" ON "GroupClass"("coachId");

-- CreateIndex
CREATE INDEX "GroupClass_status_idx" ON "GroupClass"("status");

-- CreateIndex
CREATE INDEX "GroupClass_startTime_idx" ON "GroupClass"("startTime");

-- CreateIndex
CREATE INDEX "GroupClass_venueId_idx" ON "GroupClass"("venueId");

-- CreateIndex
CREATE INDEX "GroupClass_status_startTime_idx" ON "GroupClass"("status", "startTime");

-- CreateIndex
CREATE INDEX "GroupClass_status_endTime_idx" ON "GroupClass"("status", "endTime");

-- CreateIndex
CREATE INDEX "GroupClassEnrollment_userId_idx" ON "GroupClassEnrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupClassEnrollment_groupClassId_userId_key" ON "GroupClassEnrollment"("groupClassId", "userId");

-- CreateIndex
CREATE INDEX "PrivateLessonSlot_coachId_idx" ON "PrivateLessonSlot"("coachId");

-- CreateIndex
CREATE INDEX "PrivateLessonSlot_coachId_startTime_idx" ON "PrivateLessonSlot"("coachId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateLesson_slotId_key" ON "PrivateLesson"("slotId");

-- CreateIndex
CREATE INDEX "PrivateLesson_coachId_idx" ON "PrivateLesson"("coachId");

-- CreateIndex
CREATE INDEX "PrivateLesson_studentId_idx" ON "PrivateLesson"("studentId");

-- CreateIndex
CREATE INDEX "PrivateLesson_status_idx" ON "PrivateLesson"("status");

-- CreateIndex
CREATE INDEX "PrivateLesson_status_startTime_idx" ON "PrivateLesson"("status", "startTime");

-- CreateIndex
CREATE INDEX "PrivateLesson_status_endTime_idx" ON "PrivateLesson"("status", "endTime");

-- CreateIndex
CREATE INDEX "MatchRecord_sourceType_sourceId_idx" ON "MatchRecord"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MatchRecord_recordedBy_idx" ON "MatchRecord"("recordedBy");

-- CreateIndex
CREATE INDEX "MatchPlayer_matchRecordId_idx" ON "MatchPlayer"("matchRecordId");

-- CreateIndex
CREATE INDEX "MatchPlayer_userId_idx" ON "MatchPlayer"("userId");

-- CreateIndex
CREATE INDEX "MatchGame_matchRecordId_idx" ON "MatchGame"("matchRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchGame_matchRecordId_gameNumber_key" ON "MatchGame"("matchRecordId", "gameNumber");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Review_coachId_idx" ON "Review"("coachId");

-- CreateIndex
CREATE INDEX "Review_coachId_createdAt_idx" ON "Review"("coachId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_courseType_courseId_key" ON "Review"("reviewerId", "courseType", "courseId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachProfile" ADD CONSTRAINT "CoachProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupClass" ADD CONSTRAINT "GroupClass_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupClass" ADD CONSTRAINT "GroupClass_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupClassEnrollment" ADD CONSTRAINT "GroupClassEnrollment_groupClassId_fkey" FOREIGN KEY ("groupClassId") REFERENCES "GroupClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupClassEnrollment" ADD CONSTRAINT "GroupClassEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLessonSlot" ADD CONSTRAINT "PrivateLessonSlot_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLesson" ADD CONSTRAINT "PrivateLesson_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PrivateLessonSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLesson" ADD CONSTRAINT "PrivateLesson_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLesson" ADD CONSTRAINT "PrivateLesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLesson" ADD CONSTRAINT "PrivateLesson_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRecord" ADD CONSTRAINT "MatchRecord_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchRecordId_fkey" FOREIGN KEY ("matchRecordId") REFERENCES "MatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchGame" ADD CONSTRAINT "MatchGame_matchRecordId_fkey" FOREIGN KEY ("matchRecordId") REFERENCES "MatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
