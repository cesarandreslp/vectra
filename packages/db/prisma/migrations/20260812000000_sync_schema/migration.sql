-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('PENDIENTE', 'CONTACTADO', 'CONSENTIMIENTO_PENDIENTE', 'CONSENTIDO', 'RESPONDIENDO', 'COMPLETADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ElectionOffice" AS ENUM ('ALCALDE', 'CONCEJAL', 'GOBERNADOR', 'DIPUTADO', 'REPRESENTANTE', 'SENADOR', 'PRESIDENTE');

-- CreateEnum
CREATE TYPE "EstadoTestigo" AS ENUM ('PROPUESTO', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "SurveyPreguntaType" AS ENUM ('FREE_TEXT', 'BOOLEAN', 'SINGLE_CHOICE');

-- CreateEnum
CREATE TYPE "SurveyMessageType" AS ENUM ('SENT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "MeetingTipo" AS ENUM ('RED_INTERNA', 'RECLUTAMIENTO');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PERSONALIZADO';

-- DropForeignKey
ALTER TABLE "Leader" DROP CONSTRAINT "Leader_parentLeaderId_fkey";

-- DropForeignKey
ALTER TABLE "Voter" DROP CONSTRAINT "Voter_leaderId_fkey";

-- DropIndex
DROP INDEX "User_tenantId_email_key";

-- AlterTable
ALTER TABLE "Commune" ADD COLUMN     "boundary" JSONB;

-- AlterTable
ALTER TABLE "Neighborhood" ADD COLUMN     "boundary" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customRoleId" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "voterId" TEXT;

-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "apodo" TEXT,
ADD COLUMN     "consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conversationState" "ConversationState" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "isCandidate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "status" "LeaderStatus" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "surveyContactDate" TIMESTAMP(3),
ADD COLUMN     "surveyResponseDate" TIMESTAMP(3),
ADD COLUMN     "targetVotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tieneAgenda" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zone" TEXT;

-- AlterTable
ALTER TABLE "VotingStation" ADD COLUMN     "specialLabel" TEXT;

-- DropTable
DROP TABLE "Leader";

-- CreateTable
CREATE TABLE "GlobalTrainingMaterial" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalTrainingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "perfilTipo" TEXT NOT NULL,
    "indiceFidelidad" INTEGER NOT NULL,
    "indiceRiesgo" INTEGER NOT NULL,
    "veredicto" TEXT NOT NULL,
    "planAccion" JSONB,
    "senalesDetectadas" JSONB NOT NULL,
    "justificacion" TEXT NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompromisoAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "perfilTipo" TEXT NOT NULL,
    "indiceCompromiso" INTEGER NOT NULL,
    "veredicto" TEXT NOT NULL,
    "planAccion" JSONB,
    "senalesDetectadas" JSONB NOT NULL,
    "justificacion" TEXT NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompromisoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fechaEleccion" TIMESTAMP(3),
    "metaVotos" INTEGER,
    "votosEleccionAnterior" INTEGER,
    "smtpConfig" JSONB,
    "electionCountry" TEXT NOT NULL DEFAULT 'Colombia',
    "electionOffice" "ElectionOffice",
    "electionDepartmentCode" TEXT,
    "electionMunicipalityDivipola" TEXT,
    "whatsappSurveyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappToken" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappVerifyToken" TEXT,
    "botName" TEXT DEFAULT 'Asistente Virtual',
    "surveyDailyLimit" INTEGER NOT NULL DEFAULT 250,
    "groqApiKey" TEXT,
    "zhipuApiKey" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMaterialPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "globalMaterialId" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "customOrder" INTEGER,

    CONSTRAINT "TenantMaterialPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMaterial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "maxCapacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT,
    "partyLogoUrl" TEXT,
    "photoUrl" TEXT,
    "isOwn" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WitnessAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "votingTableId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoTestigo" NOT NULL DEFAULT 'PROPUESTO',
    "votingTableIdPropuesto" TEXT,
    "observacion" TEXT,
    "resueltoAt" TIMESTAMP(3),

    CONSTRAINT "WitnessAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "E14Transmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "votingTableId" TEXT NOT NULL,
    "witnessUserId" TEXT NOT NULL,
    "manualData" JSONB,
    "manualTotal" INTEGER,
    "manualSubmittedAt" TIMESTAMP(3),
    "nivelacionE11" INTEGER,
    "nivelacionUrna" INTEGER,
    "nivelacionIncinerados" INTEGER,
    "photoUrl" TEXT,
    "extractedData" JSONB,
    "extractedTotal" INTEGER,
    "extractionConfidence" TEXT,
    "groqResult" JSONB,
    "zhipuResult" JSONB,
    "photoSubmittedAt" TIMESTAMP(3),
    "registraduriaData" JSONB,
    "registraduriaTotal" INTEGER,
    "registraduriaAt" TIMESTAMP(3),
    "registraduriaFuente" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "discrepancies" JSONB,
    "finalData" JSONB,
    "finalizedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "E14Transmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "votingTableId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segmentFilters" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "provider" TEXT,
    "providerMsgId" TEXT,
    "sentAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cargoPostulado" TEXT,
    "municipio" TEXT,
    "topeGastos" DOUBLE PRECISION,
    "fechaInicioCampana" TIMESTAMP(3),
    "fechaFinCampana" TIMESTAMP(3),
    "nombreTesorero" TEXT,
    "cedulaTesorero" TEXT,
    "cuentaBancaria" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTRADO',
    "registeredBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorId" TEXT,
    "donorType" TEXT NOT NULL DEFAULT 'PERSONA_NATURAL',
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "bankReference" TEXT,
    "receiptUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "totalExpenses" DOUBLE PRECISION NOT NULL,
    "totalDonations" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "fileUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "electionDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSurveyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCargo" (
    "id" TEXT NOT NULL,
    "surveyCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SurveyCargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyPregunta" (
    "id" TEXT NOT NULL,
    "surveyCargoId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "SurveyPreguntaType" NOT NULL DEFAULT 'FREE_TEXT',

    CONSTRAINT "SurveyPregunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyOpcion" (
    "id" TEXT NOT NULL,
    "surveyPreguntaId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SurveyOpcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyCandidato" (
    "id" TEXT NOT NULL,
    "surveyCargoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "SurveyCandidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "surveyPreguntaId" TEXT NOT NULL,
    "surveyCandidatoId" TEXT,
    "surveyOpcionId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyMessageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "type" "SurveyMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "messageId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterPushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tipo" "MeetingTipo" NOT NULL DEFAULT 'RED_INTERNA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,

    CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingProspecto" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,

    CONSTRAINT "MeetingProspecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaEntrada" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anfitrionId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "disponible" BOOLEAN NOT NULL,
    "titulo" TEXT,
    "reservadoPor" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direccion" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "ordenRuta" INTEGER,
    "cumplido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AgendaEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convocatoria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "convocanteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "lugar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direccion" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "ordenRuta" INTEGER,
    "cumplido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Convocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvocatoriaDestinatario" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,

    CONSTRAINT "ConvocatoriaDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomRole_tenantId_idx" ON "CustomRole"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_tenantId_name_key" ON "CustomRole"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRolePermission_roleId_screenKey_key" ON "CustomRolePermission"("roleId", "screenKey");

-- CreateIndex
CREATE INDEX "LeaderAnalysis_tenantId_leaderId_generadoEn_idx" ON "LeaderAnalysis"("tenantId", "leaderId", "generadoEn");

-- CreateIndex
CREATE INDEX "CompromisoAnalysis_tenantId_voterId_generadoEn_idx" ON "CompromisoAnalysis"("tenantId", "voterId", "generadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMaterialPreference_tenantId_globalMaterialId_key" ON "TenantMaterialPreference"("tenantId", "globalMaterialId");

-- CreateIndex
CREATE INDEX "TrainingMaterial_tenantId_idx" ON "TrainingMaterial"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingSession_tenantId_idx" ON "TrainingSession"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingAttendance_tenantId_userId_idx" ON "TrainingAttendance"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttendance_sessionId_userId_key" ON "TrainingAttendance"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "Quiz_tenantId_idx" ON "Quiz"("tenantId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_tenantId_userId_idx" ON "QuizAttempt"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_userId_idx" ON "QuizAttempt"("quizId", "userId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_userId_idx" ON "Certificate"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_tenantId_userId_quizId_key" ON "Certificate"("tenantId", "userId", "quizId");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_idx" ON "Candidate"("tenantId");

-- CreateIndex
CREATE INDEX "WitnessAssignment_tenantId_userId_idx" ON "WitnessAssignment"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WitnessAssignment_tenantId_votingTableId_isPrimary_key" ON "WitnessAssignment"("tenantId", "votingTableId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "E14Transmission_votingTableId_key" ON "E14Transmission"("votingTableId");

-- CreateIndex
CREATE INDEX "E14Transmission_tenantId_verificationStatus_idx" ON "E14Transmission"("tenantId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Incident_tenantId_status_severity_idx" ON "Incident"("tenantId", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionResult_tenantId_candidateId_key" ON "ElectionResult"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_channel_isActive_idx" ON "MessageTemplate"("tenantId", "channel", "isActive");

-- CreateIndex
CREATE INDEX "MessageCampaign_tenantId_status_idx" ON "MessageCampaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Message_tenantId_campaignId_status_idx" ON "Message"("tenantId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "Message_tenantId_recipientId_idx" ON "Message"("tenantId", "recipientId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_trigger_isActive_idx" ON "AutomationRule"("tenantId", "trigger", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceConfig_tenantId_key" ON "FinanceConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Donation_tenantId_date_idx" ON "Donation"("tenantId", "date");

-- CreateIndex
CREATE INDEX "FinanceReport_tenantId_type_idx" ON "FinanceReport"("tenantId", "type");

-- CreateIndex
CREATE INDEX "SurveyCampaign_tenantId_idx" ON "SurveyCampaign"("tenantId");

-- CreateIndex
CREATE INDEX "SurveyCargo_surveyCampaignId_idx" ON "SurveyCargo"("surveyCampaignId");

-- CreateIndex
CREATE INDEX "SurveyPregunta_surveyCargoId_idx" ON "SurveyPregunta"("surveyCargoId");

-- CreateIndex
CREATE INDEX "SurveyOpcion_surveyPreguntaId_idx" ON "SurveyOpcion"("surveyPreguntaId");

-- CreateIndex
CREATE INDEX "SurveyCandidato_surveyCargoId_idx" ON "SurveyCandidato"("surveyCargoId");

-- CreateIndex
CREATE INDEX "SurveyResponse_tenantId_idx" ON "SurveyResponse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_voterId_surveyPreguntaId_key" ON "SurveyResponse"("voterId", "surveyPreguntaId");

-- CreateIndex
CREATE INDEX "SurveyMessageLog_voterId_messageId_idx" ON "SurveyMessageLog"("voterId", "messageId");

-- CreateIndex
CREATE INDEX "SurveyMessageLog_tenantId_idx" ON "SurveyMessageLog"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterPushSubscription_endpoint_key" ON "VoterPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "VoterPushSubscription_tenantId_idx" ON "VoterPushSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "VoterPushSubscription_voterId_idx" ON "VoterPushSubscription"("voterId");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_leaderId_idx" ON "Meeting"("tenantId", "leaderId");

-- CreateIndex
CREATE INDEX "MeetingAttendance_voterId_idx" ON "MeetingAttendance"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_voterId_key" ON "MeetingAttendance"("meetingId", "voterId");

-- CreateIndex
CREATE INDEX "MeetingProspecto_meetingId_idx" ON "MeetingProspecto"("meetingId");

-- CreateIndex
CREATE INDEX "AgendaEntrada_tenantId_anfitrionId_startsAt_idx" ON "AgendaEntrada"("tenantId", "anfitrionId", "startsAt");

-- CreateIndex
CREATE INDEX "Convocatoria_tenantId_convocanteId_idx" ON "Convocatoria"("tenantId", "convocanteId");

-- CreateIndex
CREATE INDEX "ConvocatoriaDestinatario_voterId_idx" ON "ConvocatoriaDestinatario"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "ConvocatoriaDestinatario_convocatoriaId_voterId_key" ON "ConvocatoriaDestinatario"("convocatoriaId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
-- El índice existente es parcial (WHERE "cedulaHash" IS NOT NULL), escrito a mano en
-- 20260402000001. Prisma no puede representar índices parciales, así que no lo ve como
-- suyo e intenta crear uno con el mismo nombre. Se reemplaza por el que Prisma sí gestiona:
-- en Postgres los NULL son distintos entre sí en un UNIQUE, así que el comportamiento no cambia.
DROP INDEX IF EXISTS "Voter_tenantId_cedulaHash_key";
CREATE UNIQUE INDEX "Voter_tenantId_cedulaHash_key" ON "Voter"("tenantId", "cedulaHash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRolePermission" ADD CONSTRAINT "CustomRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCargo" ADD CONSTRAINT "SurveyCargo_surveyCampaignId_fkey" FOREIGN KEY ("surveyCampaignId") REFERENCES "SurveyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyPregunta" ADD CONSTRAINT "SurveyPregunta_surveyCargoId_fkey" FOREIGN KEY ("surveyCargoId") REFERENCES "SurveyCargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyOpcion" ADD CONSTRAINT "SurveyOpcion_surveyPreguntaId_fkey" FOREIGN KEY ("surveyPreguntaId") REFERENCES "SurveyPregunta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyCandidato" ADD CONSTRAINT "SurveyCandidato_surveyCargoId_fkey" FOREIGN KEY ("surveyCargoId") REFERENCES "SurveyCargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyPreguntaId_fkey" FOREIGN KEY ("surveyPreguntaId") REFERENCES "SurveyPregunta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyCandidatoId_fkey" FOREIGN KEY ("surveyCandidatoId") REFERENCES "SurveyCandidato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyOpcionId_fkey" FOREIGN KEY ("surveyOpcionId") REFERENCES "SurveyOpcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyMessageLog" ADD CONSTRAINT "SurveyMessageLog_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterPushSubscription" ADD CONSTRAINT "VoterPushSubscription_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProspecto" ADD CONSTRAINT "MeetingProspecto_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEntrada" ADD CONSTRAINT "AgendaEntrada_anfitrionId_fkey" FOREIGN KEY ("anfitrionId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEntrada" ADD CONSTRAINT "AgendaEntrada_reservadoPor_fkey" FOREIGN KEY ("reservadoPor") REFERENCES "Voter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convocatoria" ADD CONSTRAINT "Convocatoria_convocanteId_fkey" FOREIGN KEY ("convocanteId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocatoriaDestinatario" ADD CONSTRAINT "ConvocatoriaDestinatario_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocatoriaDestinatario" ADD CONSTRAINT "ConvocatoriaDestinatario_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

