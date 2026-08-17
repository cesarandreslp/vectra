-- AlterTable
ALTER TABLE "VotingStation" ADD COLUMN     "zonaId" TEXT;

-- CreateTable
CREATE TABLE "Zona" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "Zona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zona_municipalityId_code_key" ON "Zona"("municipalityId", "code");

-- AddForeignKey
ALTER TABLE "Zona" ADD CONSTRAINT "Zona_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingStation" ADD CONSTRAINT "VotingStation_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
