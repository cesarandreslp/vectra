-- CreateTable
CREATE TABLE "HitoEstructura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "contactos" INTEGER NOT NULL,
    "compromisos" INTEGER NOT NULL,
    "lideres" INTEGER NOT NULL,
    "multiplicadores" INTEGER NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HitoEstructura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HitoEstructura_tenantId_fecha_idx" ON "HitoEstructura"("tenantId", "fecha");
