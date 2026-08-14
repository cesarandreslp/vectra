-- AlterTable
ALTER TABLE "E14Transmission" ADD COLUMN     "mistralResult" JSONB;

-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN     "mistralApiKey" TEXT;
