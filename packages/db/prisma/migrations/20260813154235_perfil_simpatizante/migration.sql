-- CreateEnum
CREATE TYPE "VehiculoPropio" AS ENUM ('NINGUNO', 'BICICLETA', 'MOTO', 'CARRO', 'CAMION');

-- CreateEnum
CREATE TYPE "NivelEducativo" AS ENUM ('PRIMARIA', 'BACHILLER', 'TECNICO', 'UNIVERSITARIO', 'POSGRADO');

-- CreateTable
CREATE TABLE "PerfilSimpatizante" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "oficio" TEXT,
    "habilidades" TEXT[],
    "herramientas" TEXT[],
    "disponibilidad" TEXT[],
    "vehiculo" "VehiculoPropio" NOT NULL DEFAULT 'NINGUNO',
    "nivelEducativo" "NivelEducativo",
    "experiencia" TEXT,
    "zonaAccion" TEXT,
    "aceptaWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilSimpatizante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilSimpatizante_voterId_key" ON "PerfilSimpatizante"("voterId");

-- CreateIndex
CREATE INDEX "PerfilSimpatizante_tenantId_idx" ON "PerfilSimpatizante"("tenantId");

-- AddForeignKey
ALTER TABLE "PerfilSimpatizante" ADD CONSTRAINT "PerfilSimpatizante_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
