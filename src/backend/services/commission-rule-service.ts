import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export type CommissionRuleResponse = {
  id: string;
  commissionType: string;
  percentage: Prisma.Decimal | null;
  fixedAmount: Prisma.Decimal | null;
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  radiologyCenterId: string;
  examId: string;
  dentistId: string | null;
};

export type CreateCommissionRuleInput = {
  commissionType: "PERCENTAGE" | "FIXED" | "NONE";
  percentage?: number | null;
  fixedAmount?: number | null;
  validFrom: Date;
  validTo?: Date | null;
  priority: number;
  radiologyCenterId: string;
  examId: string;
  dentistId?: string | null;
};

export type UpdateCommissionRuleInput = {
  commissionType?: "PERCENTAGE" | "FIXED" | "NONE";
  percentage?: number | null;
  fixedAmount?: number | null;
  validFrom?: Date;
  validTo?: Date | null;
  isActive?: boolean;
  priority?: number;
};

export type ListCommissionRulesFilters = {
  radiologyCenterId?: string;
  examId?: string;
  dentistId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export async function listCommissionRules(
  filters: ListCommissionRulesFilters
): Promise<{
  data: CommissionRuleResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1);
  const limit = Math.max(1, Math.min(Number.isInteger(filters.limit) && filters.limit! > 0 ? filters.limit! : 20, 100));
  const skip = (page - 1) * limit;

  const where: Prisma.CommissionRuleWhereInput = {
    ...(filters.radiologyCenterId && {
      radiologyCenterId: filters.radiologyCenterId
    }),
    ...(filters.examId && {
      examId: filters.examId
    }),
    ...(filters.dentistId !== undefined && {
      dentistId: filters.dentistId || null
    }),
    ...(filters.isActive !== undefined && {
      isActive: filters.isActive
    })
  };

  const [data, total] = await Promise.all([
    prisma.commissionRule.findMany({
      where,
      select: {
        id: true,
        commissionType: true,
        percentage: true,
        fixedAmount: true,
        validFrom: true,
        validTo: true,
        isActive: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        radiologyCenterId: true,
        examId: true,
        dentistId: true
      },
      orderBy: [
        { radiologyCenterId: "asc" },
        { examId: "asc" },
        { dentistId: "asc" },
        { validFrom: "desc" }
      ],
      skip,
      take: limit
    }),
    prisma.commissionRule.count({ where })
  ]);

  return {
    data: data as CommissionRuleResponse[],
    total,
    page,
    limit
  };
}

export async function getCommissionRuleById(
  id: string,
  client: any = prisma
): Promise<CommissionRuleResponse | null> {
  return (client.commissionRule as any).findFirst({
    where: { id },
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true,
      validFrom: true,
      validTo: true,
      isActive: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      radiologyCenterId: true,
      examId: true,
      dentistId: true
    }
  });
}

export async function createCommissionRuleInTx(
  data: CreateCommissionRuleInput,
  tx: Prisma.TransactionClient
): Promise<CommissionRuleResponse> {
  return (tx.commissionRule as any).create({
    data: {
      commissionType: data.commissionType,
      percentage: data.percentage !== undefined && data.percentage !== null ? data.percentage : null,
      fixedAmount: data.fixedAmount !== undefined && data.fixedAmount !== null ? data.fixedAmount : null,
      validFrom: data.validFrom,
      validTo: data.validTo !== undefined && data.validTo !== null ? data.validTo : null,
      isActive: true,
      priority: data.priority,
      radiologyCenterId: data.radiologyCenterId,
      examId: data.examId,
      dentistId: data.dentistId !== undefined && data.dentistId !== null ? data.dentistId : null
    },
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true,
      validFrom: true,
      validTo: true,
      isActive: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      radiologyCenterId: true,
      examId: true,
      dentistId: true
    }
  });
}

export async function updateCommissionRuleInTx(
  id: string,
  data: UpdateCommissionRuleInput,
  tx: Prisma.TransactionClient
): Promise<CommissionRuleResponse | null> {
  const updateData: Record<string, unknown> = {};

  if (data.commissionType !== undefined) updateData.commissionType = data.commissionType;
  if (data.percentage !== undefined) updateData.percentage = data.percentage !== null ? data.percentage : null;
  if (data.fixedAmount !== undefined) updateData.fixedAmount = data.fixedAmount !== null ? data.fixedAmount : null;
  if (data.validFrom !== undefined) updateData.validFrom = data.validFrom;
  if (data.validTo !== undefined) updateData.validTo = data.validTo !== null ? data.validTo : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.priority !== undefined) updateData.priority = data.priority;

  if (Object.keys(updateData).length === 0) {
    return getCommissionRuleById(id, tx);
  }

  return (tx.commissionRule as any).update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true,
      validFrom: true,
      validTo: true,
      isActive: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      radiologyCenterId: true,
      examId: true,
      dentistId: true
    }
  });
}

export async function deleteCommissionRule(
  id: string
): Promise<CommissionRuleResponse | null> {
  const existing = await getCommissionRuleById(id);
  if (!existing) {
    return null;
  }

  return prisma.commissionRule.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true,
      validFrom: true,
      validTo: true,
      isActive: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      radiologyCenterId: true,
      examId: true,
      dentistId: true
    }
  });
}
