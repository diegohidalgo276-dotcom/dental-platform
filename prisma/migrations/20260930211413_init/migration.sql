-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RADIOLOGY_CENTER_ADMIN', 'RADIOLOGY_CENTER_STAFF', 'DENTIST');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('ORDER_NUMBER', 'BATCH_NUMBER');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'NONE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderExamStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExamResultStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'EXPORTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVE', 'PAY', 'CANCEL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_radiology_centers" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,

    CONSTRAINT "user_radiology_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "dentists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryIdNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dentistId" TEXT NOT NULL,

    CONSTRAINT "dentist_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "radiology_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "sequenceType" "SequenceType" NOT NULL,
    "currentValue" BIGINT NOT NULL DEFAULT 0,
    "radiologyCenterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentist_centers" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dentistId" TEXT NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,

    CONSTRAINT "dentist_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "birthDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_prices" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "examId" TEXT NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,

    CONSTRAINT "exam_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixedAmount" DECIMAL(10,2),
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "dentistId" TEXT,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_exams" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "commissionValue" DECIMAL(10,2) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "status" "OrderExamStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "commissionRuleId" TEXT,

    CONSTRAINT "order_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "notes" TEXT,
    "status" "ExamResultStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderExamId" TEXT NOT NULL,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderExamId" TEXT NOT NULL,
    "commissionRuleId" TEXT NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "description" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "exportFormat" TEXT,
    "bankName" TEXT,
    "exportFilePath" TEXT,
    "status" "PaymentBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "radiologyCenterId" TEXT NOT NULL,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commissionId" TEXT NOT NULL,
    "paymentBatchId" TEXT NOT NULL,
    "dentistBankAccountId" TEXT NOT NULL,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "user_radiology_centers_userId_idx" ON "user_radiology_centers"("userId");

-- CreateIndex
CREATE INDEX "user_radiology_centers_radiologyCenterId_idx" ON "user_radiology_centers"("radiologyCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_radiology_centers_userId_radiologyCenterId_key" ON "user_radiology_centers"("userId", "radiologyCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_email_key" ON "dentists"("email");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_licenseNumber_key" ON "dentists"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_taxId_key" ON "dentists"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "dentists_userId_key" ON "dentists"("userId");

-- CreateIndex
CREATE INDEX "dentists_email_idx" ON "dentists"("email");

-- CreateIndex
CREATE INDEX "dentists_licenseNumber_idx" ON "dentists"("licenseNumber");

-- CreateIndex
CREATE INDEX "dentists_isActive_idx" ON "dentists"("isActive");

-- CreateIndex
CREATE INDEX "dentist_bank_accounts_dentistId_isActive_idx" ON "dentist_bank_accounts"("dentistId", "isActive");

-- CreateIndex
CREATE INDEX "dentist_bank_accounts_dentistId_idx" ON "dentist_bank_accounts"("dentistId");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_bank_accounts_dentistId_accountNumber_validFrom_key" ON "dentist_bank_accounts"("dentistId", "accountNumber", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_centers_taxId_key" ON "radiology_centers"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_centers_email_key" ON "radiology_centers"("email");

-- CreateIndex
CREATE INDEX "radiology_centers_taxId_idx" ON "radiology_centers"("taxId");

-- CreateIndex
CREATE INDEX "radiology_centers_isActive_idx" ON "radiology_centers"("isActive");

-- CreateIndex
CREATE INDEX "sequences_radiologyCenterId_idx" ON "sequences"("radiologyCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_radiologyCenterId_sequenceType_key" ON "sequences"("radiologyCenterId", "sequenceType");

-- CreateIndex
CREATE INDEX "dentist_centers_dentistId_idx" ON "dentist_centers"("dentistId");

-- CreateIndex
CREATE INDEX "dentist_centers_radiologyCenterId_idx" ON "dentist_centers"("radiologyCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "dentist_centers_dentistId_radiologyCenterId_key" ON "dentist_centers"("dentistId", "radiologyCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_document_key" ON "patients"("document");

-- CreateIndex
CREATE INDEX "patients_document_idx" ON "patients"("document");

-- CreateIndex
CREATE INDEX "patients_isActive_idx" ON "patients"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "exams_code_key" ON "exams"("code");

-- CreateIndex
CREATE INDEX "exams_code_idx" ON "exams"("code");

-- CreateIndex
CREATE INDEX "exams_isActive_idx" ON "exams"("isActive");

-- CreateIndex
CREATE INDEX "exam_prices_examId_idx" ON "exam_prices"("examId");

-- CreateIndex
CREATE INDEX "exam_prices_radiologyCenterId_idx" ON "exam_prices"("radiologyCenterId");

-- CreateIndex
CREATE INDEX "exam_prices_radiologyCenterId_examId_validFrom_validTo_idx" ON "exam_prices"("radiologyCenterId", "examId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "exam_prices_examId_radiologyCenterId_validFrom_key" ON "exam_prices"("examId", "radiologyCenterId", "validFrom");

-- CreateIndex
CREATE INDEX "commission_rules_radiologyCenterId_idx" ON "commission_rules"("radiologyCenterId");

-- CreateIndex
CREATE INDEX "commission_rules_examId_idx" ON "commission_rules"("examId");

-- CreateIndex
CREATE INDEX "commission_rules_dentistId_idx" ON "commission_rules"("dentistId");

-- CreateIndex
CREATE INDEX "commission_rules_radiologyCenterId_examId_dentistId_validFr_idx" ON "commission_rules"("radiologyCenterId", "examId", "dentistId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "commission_rules_isActive_idx" ON "commission_rules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "commission_rules_radiologyCenterId_examId_dentistId_validFr_key" ON "commission_rules"("radiologyCenterId", "examId", "dentistId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_patientId_idx" ON "orders"("patientId");

-- CreateIndex
CREATE INDEX "orders_dentistId_idx" ON "orders"("dentistId");

-- CreateIndex
CREATE INDEX "orders_radiologyCenterId_idx" ON "orders"("radiologyCenterId");

-- CreateIndex
CREATE INDEX "orders_radiologyCenterId_dentistId_idx" ON "orders"("radiologyCenterId", "dentistId");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_exams_orderId_idx" ON "order_exams"("orderId");

-- CreateIndex
CREATE INDEX "order_exams_examId_idx" ON "order_exams"("examId");

-- CreateIndex
CREATE INDEX "order_exams_status_idx" ON "order_exams"("status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_orderExamId_key" ON "exam_results"("orderExamId");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_orderExamId_key" ON "commissions"("orderExamId");

-- CreateIndex
CREATE INDEX "commissions_orderExamId_idx" ON "commissions"("orderExamId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_status_createdAt_idx" ON "commissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "commissions_approvedAt_idx" ON "commissions"("approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_batchNumber_key" ON "payment_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "payment_batches_batchNumber_idx" ON "payment_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "payment_batches_radiologyCenterId_idx" ON "payment_batches"("radiologyCenterId");

-- CreateIndex
CREATE INDEX "payment_batches_radiologyCenterId_status_idx" ON "payment_batches"("radiologyCenterId", "status");

-- CreateIndex
CREATE INDEX "payment_batches_status_createdAt_idx" ON "payment_batches"("status", "createdAt");

-- CreateIndex
CREATE INDEX "commission_payments_commissionId_idx" ON "commission_payments"("commissionId");

-- CreateIndex
CREATE INDEX "commission_payments_paymentBatchId_idx" ON "commission_payments"("paymentBatchId");

-- CreateIndex
CREATE INDEX "commission_payments_dentistBankAccountId_idx" ON "commission_payments"("dentistBankAccountId");

-- CreateIndex
CREATE INDEX "commission_payments_paymentDate_idx" ON "commission_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "commission_payments_status_idx" ON "commission_payments"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_action_createdAt_idx" ON "audit_logs"("entityType", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "user_radiology_centers" ADD CONSTRAINT "user_radiology_centers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_radiology_centers" ADD CONSTRAINT "user_radiology_centers_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentists" ADD CONSTRAINT "dentists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_bank_accounts" ADD CONSTRAINT "dentist_bank_accounts_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_centers" ADD CONSTRAINT "dentist_centers_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_centers" ADD CONSTRAINT "dentist_centers_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_prices" ADD CONSTRAINT "exam_prices_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_prices" ADD CONSTRAINT "exam_prices_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "dentists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_exams" ADD CONSTRAINT "order_exams_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_exams" ADD CONSTRAINT "order_exams_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_exams" ADD CONSTRAINT "order_exams_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_orderExamId_fkey" FOREIGN KEY ("orderExamId") REFERENCES "order_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_orderExamId_fkey" FOREIGN KEY ("orderExamId") REFERENCES "order_exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "commission_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_radiologyCenterId_fkey" FOREIGN KEY ("radiologyCenterId") REFERENCES "radiology_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_paymentBatchId_fkey" FOREIGN KEY ("paymentBatchId") REFERENCES "payment_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_dentistBankAccountId_fkey" FOREIGN KEY ("dentistBankAccountId") REFERENCES "dentist_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
