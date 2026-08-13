-- CreateEnum
CREATE TYPE "Posgrado" AS ENUM ('ESPECIALISTA', 'MAGISTER', 'DOCTOR');

-- AlterEnum
ALTER TYPE "NivelEducativo" ADD VALUE 'TECNOLOGO';

-- AlterTable
ALTER TABLE "PerfilSimpatizante" ADD COLUMN     "certificaciones" TEXT[],
ADD COLUMN     "posgrado" "Posgrado",
ADD COLUMN     "posgradoEn" TEXT,
ADD COLUMN     "tituloEn" TEXT;
