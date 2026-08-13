/*
  Warnings:

  - Added the required column `dolienteId` to the `Actividad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN     "dolienteId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Actividad_tenantId_dolienteId_idx" ON "Actividad"("tenantId", "dolienteId");

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_dolienteId_fkey" FOREIGN KEY ("dolienteId") REFERENCES "Voter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
