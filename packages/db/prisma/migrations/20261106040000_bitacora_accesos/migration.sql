-- CreateTable
CREATE TABLE "RegistroAcceso" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "sujeto" TEXT,
    "claveHash" TEXT,
    "ip" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroAcceso_claveHash_accion_fecha_idx" ON "RegistroAcceso"("claveHash", "accion", "fecha");

-- CreateIndex
CREATE INDEX "RegistroAcceso_ip_accion_fecha_idx" ON "RegistroAcceso"("ip", "accion", "fecha");

-- CreateIndex
CREATE INDEX "RegistroAcceso_tenantId_fecha_idx" ON "RegistroAcceso"("tenantId", "fecha");

