-- AlterTable
ALTER TABLE "Commune" ADD COLUMN     "liderId" TEXT;

-- AlterTable
ALTER TABLE "Neighborhood" ADD COLUMN     "liderId" TEXT;

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "neighborhoodId" TEXT;

-- CreateIndex
CREATE INDEX "Voter_tenantId_neighborhoodId_idx" ON "Voter"("tenantId", "neighborhoodId");

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
