import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type CommissionResponse = {
  id: string;
  amount: Prisma.Decimal;
  status: CommissionStatus;
  notes: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderExamId: string;
  commissionRuleId: string;
};

export type ApproveCommissionInput = {
  approvedBy: string;
  notes?: string | null;
};

export type CancelCommissionInput = {
  cancelledBy: string;
  cancellationReason: string;
};

export type ListCommissionsFilters = {
  dentistId?: string;
  radiologyCenterId?: string;
  status?: CommissionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
};

export type GenerateCommissionResult = {
  orderExamId: string;
  success: boolean;
  commission?: CommissionResponse;
  error?: string;
};

async function getOrderExamWithCommissionData(orderExamId: string) {
  return prisma.orderExam.findUnique({
    where: { id: orderExamId },
    select: {
      id: true,
      status: true,
      commissionType: true,
      commissionAmount: true,
      commissionRuleId: true,
      orderId: true,
      order: {
        select: {
          id: true,
          dentistId: true,
          radiologyCenterId: true,
        },
      },
    },
  });
}

export async function generateCommissionFromOrderExam(
  orderExamId: string
): Promise<CommissionResponse> {
  const orderExam = await getOrderExamWithCommissionData(orderExamId);

  if (!orderExam) {
    throw new Error("ORDER_EXAM_NOT_FOUND");
  }

  if (orderExam.status !== "COMPLETED") {
    throw new Error("ORDER_EXAM_NOT_COMPLETED");
  }

  if (orderExam.commissionType === "NONE") {
    throw new Error("COMMISSION_NOT_ELIGIBLE");
  }

  if (!orderExam.commissionRuleId) {
    throw new Error("COMMISSION_NOT_ELIGIBLE");
  }

  const commissionAmount = orderExam.commissionAmount;
  if (!commissionAmount || commissionAmount.lte(0)) {
    throw new Error("COMMISSION_NOT_ELIGIBLE");
  }

  const existingCommission = await prisma.commission.findUnique({
    where: { orderExamId },
    select: { id: true },
  });

  if (existingCommission) {
    throw new Error("COMMISSION_ALREADY_EXISTS");
  }

  try {
    return await prisma.commission.create({
      data: {
        amount: commissionAmount,
        status: "PENDING",
        orderExamId,
        commissionRuleId: orderExam.commissionRuleId!,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        approvedAt: true,
        approvedBy: true,
        paidAt: true,
        cancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        orderExamId: true,
        commissionRuleId: true,
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      throw new Error("COMMISSION_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function generateCommissionsForOrder(
  orderId: string
): Promise<GenerateCommissionResult[]> {
  const orderExams = await prisma.orderExam.findMany({
    where: { orderId },
    select: {
      id: true,
      status: true,
      commissionType: true,
      commissionAmount: true,
      commissionRuleId: true,
    },
  });

  const results: GenerateCommissionResult[] = [];

  for (const orderExam of orderExams) {
    try {
      const commission = await generateCommissionFromOrderExam(orderExam.id);
      results.push({
        orderExamId: orderExam.id,
        success: true,
        commission,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      let errorCode = "UNKNOWN_ERROR";

      if (err.message === "ORDER_EXAM_NOT_FOUND") {
        errorCode = "ORDER_EXAM_NOT_FOUND";
      } else if (err.message === "ORDER_EXAM_NOT_COMPLETED") {
        errorCode = "ORDER_EXAM_NOT_COMPLETED";
      } else if (err.message === "COMMISSION_NOT_ELIGIBLE") {
        errorCode = "COMMISSION_NOT_ELIGIBLE";
      } else if (err.message === "COMMISSION_ALREADY_EXISTS") {
        errorCode = "COMMISSION_ALREADY_EXISTS";
      }

      results.push({
        orderExamId: orderExam.id,
        success: false,
        error: errorCode,
      });
    }
  }

  return results;
}

export async function getCommissionById(
  id: string
): Promise<CommissionResponse | null> {
  return prisma.commission.findUnique({
    where: { id },
    select: {
      id: true,
      amount: true,
      status: true,
      notes: true,
      approvedAt: true,
      approvedBy: true,
      paidAt: true,
      cancelledAt: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
      commissionRuleId: true,
    },
  });
}

export async function getCommissionByOrderExamId(
  orderExamId: string
): Promise<CommissionResponse | null> {
  return prisma.commission.findUnique({
    where: { orderExamId },
    select: {
      id: true,
      amount: true,
      status: true,
      notes: true,
      approvedAt: true,
      approvedBy: true,
      paidAt: true,
      cancelledAt: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
      commissionRuleId: true,
    },
  });
}

export async function listCommissions(
  filters: ListCommissionsFilters
): Promise<{
  data: CommissionResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1);
  const limit = Math.max(1, Math.min(Number.isInteger(filters.limit) && filters.limit! > 0 ? filters.limit! : 20, 100));
  const skip = (page - 1) * limit;

  const relationFilters: Prisma.CommissionWhereInput[] = [];

  if (filters.dentistId !== undefined) {
    relationFilters.push({
      orderExam: {
        order: {
          dentistId: filters.dentistId,
        },
      },
    });
  }

  if (filters.radiologyCenterId !== undefined) {
    relationFilters.push({
      orderExam: {
        order: {
          radiologyCenterId: filters.radiologyCenterId,
        },
      },
    });
  }

  const where: Prisma.CommissionWhereInput = {
    ...(filters.status && { status: filters.status as any }),
    ...(filters.dateFrom && { createdAt: { gte: filters.dateFrom } }),
    ...(filters.dateTo && { createdAt: { lte: filters.dateTo } }),
    ...(relationFilters.length > 0 && { AND: relationFilters }),
  };

  const [data, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        approvedAt: true,
        approvedBy: true,
        paidAt: true,
        cancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        orderExamId: true,
        commissionRuleId: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.commission.count({ where }),
  ]);

  return {
    data: data as CommissionResponse[],
    total,
    page,
    limit,
  };
}

export async function approveCommission(
  id: string,
  input: ApproveCommissionInput
): Promise<CommissionResponse | null> {
  const existing = await prisma.commission.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return null;
  }

  if (existing.status !== "PENDING") {
    throw new Error("COMMISSION_CANNOT_BE_APPROVED");
  }

  try {
    return await prisma.commission.update({
      where: {
        id,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: input.approvedBy,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        approvedAt: true,
        approvedBy: true,
        paidAt: true,
        cancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        orderExamId: true,
        commissionRuleId: true,
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2025") {
      throw new Error("COMMISSION_CONCURRENT_UPDATE");
    }
    throw error;
  }
}

export async function cancelCommission(
  id: string,
  input: CancelCommissionInput
): Promise<CommissionResponse | null> {
  const existing = await prisma.commission.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return null;
  }

  if (existing.status === "PAID") {
    throw new Error("COMMISSION_CANNOT_BE_CANCELLED");
  }

  if (existing.status !== "PENDING" && existing.status !== "APPROVED") {
    throw new Error("COMMISSION_CANNOT_BE_CANCELLED");
  }

  if (!input.cancellationReason || input.cancellationReason.trim() === "") {
    throw new Error("CANCELLATION_REASON_REQUIRED");
  }

  try {
    return await prisma.commission.update({
      where: {
        id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: input.cancellationReason,
      },
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        approvedAt: true,
        approvedBy: true,
        paidAt: true,
        cancelledAt: true,
        cancellationReason: true,
        createdAt: true,
        updatedAt: true,
        orderExamId: true,
        commissionRuleId: true,
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2025") {
      throw new Error("COMMISSION_CONCURRENT_UPDATE");
    }
    throw error;
  }
}