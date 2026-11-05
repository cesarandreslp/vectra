-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "whatsappPlantilla" TEXT,
ADD COLUMN     "whatsappVariables" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "programadoPara" TIMESTAMP(3),
ADD COLUMN     "reglaId" TEXT,
ALTER COLUMN "to" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Message_status_programadoPara_idx" ON "Message"("status", "programadoPara");

-- CreateIndex
CREATE UNIQUE INDEX "Message_reglaId_recipientId_key" ON "Message"("reglaId", "recipientId");

