-- CreateTable
CREATE TABLE "VoterEstadoCambio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "status" "LeaderStatus" NOT NULL,
    "porUserId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterEstadoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoterEstadoCambio_tenantId_voterId_fecha_idx" ON "VoterEstadoCambio"("tenantId", "voterId", "fecha");

-- AddForeignKey
ALTER TABLE "VoterEstadoCambio" ADD CONSTRAINT "VoterEstadoCambio_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

