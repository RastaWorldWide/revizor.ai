-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'REVIEWS_IMPORTED', 'SITE_GENERATED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "fullAddress" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewsCount" INTEGER,
    "schedule" JSONB,
    "rubrics" JSONB,
    "contacts" JSONB,
    "point" JSONB,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT,
    "authorName" TEXT,
    "rating" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT '2gis',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedSite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "analysis" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Place_projectId_key" ON "Place"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_firmId_key" ON "Place"("firmId");

-- CreateIndex
CREATE INDEX "Review_projectId_idx" ON "Review"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_projectId_text_key" ON "Review"("projectId", "text");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedSite_projectId_key" ON "GeneratedSite"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedSite_slug_key" ON "GeneratedSite"("slug");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedSite" ADD CONSTRAINT "GeneratedSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
