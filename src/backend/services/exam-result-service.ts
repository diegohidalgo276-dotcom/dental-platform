import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export type ExamResultStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REVIEWED";

export type ExamResultResponse = {
  id: string;
  fileUrl: string | null;
  fileType: string | null;
  notes: string | null;
  status: ExamResultStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  orderExamId: string;
};

export type CreateExamResultInput = {
  orderExamId: string;
  fileUrl: string;
  fileType?: string | null;
  notes?: string | null;
  status?: ExamResultStatus;
};

export type UpdateExamResultInput = {
  fileUrl?: string | null;
  fileType?: string | null;
  notes?: string | null;
  status?: ExamResultStatus;
};

export type ListExamResultsFilters = {
  orderExamId?: string;
  dentistId?: string;
  radiologyCenterIds?: string[];
  status?: ExamResultStatus;
  page?: number;
  limit?: number;
};

async function getOrderExamWithRelations(orderExamId: string) {
  return prisma.orderExam.findUnique({
    where: { id: orderExamId },
    select: {
      id: true,
      orderId: true,
      examId: true,
      status: true,
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

export async function createExamResult(
  data: CreateExamResultInput
): Promise<ExamResultResponse> {
  const orderExam = await getOrderExamWithRelations(data.orderExamId);

  if (!orderExam) {
    throw new Error("ORDER_EXAM_NOT_FOUND");
  }

  const existingResult = await prisma.examResult.findUnique({
    where: { orderExamId: data.orderExamId },
    select: { id: true },
  });

  if (existingResult) {
    throw new Error("EXAM_RESULT_ALREADY_EXISTS");
  }

  const status = data.status || "PENDING";
  const completedAt = ["COMPLETED", "REVIEWED"].includes(status)
    ? new Date()
    : null;

  return prisma.examResult.create({
    data: {
      fileUrl: data.fileUrl,
      fileType: data.fileType ?? null,
      notes: data.notes ?? null,
      status,
      completedAt,
      orderExamId: data.orderExamId,
    },
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      notes: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
    },
  });
}

export async function getExamResultById(
  id: string
): Promise<ExamResultResponse | null> {
  return prisma.examResult.findUnique({
    where: { id },
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      notes: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
    },
  });
}

export async function getExamResultByOrderExamId(
  orderExamId: string
): Promise<ExamResultResponse | null> {
  return prisma.examResult.findUnique({
    where: { orderExamId },
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      notes: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
    },
  });
}

export async function updateExamResult(
  id: string,
  data: UpdateExamResultInput
): Promise<ExamResultResponse | null> {
  const existing = await prisma.examResult.findUnique({
    where: { id },
    select: { id: true, status: true, completedAt: true },
  });

  if (!existing) {
    return null;
  }

  const updateData: Record<string, unknown> = {};
  let hasChanges = false;

  if (data.fileUrl !== undefined) {
    updateData.fileUrl = data.fileUrl;
    hasChanges = true;
  }
  if (data.fileType !== undefined) {
    updateData.fileType = data.fileType;
    hasChanges = true;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes;
    hasChanges = true;
  }
  if (data.status !== undefined && data.status !== existing.status) {
    updateData.status = data.status;
    hasChanges = true;

    if (["COMPLETED", "REVIEWED"].includes(data.status) && !existing.completedAt) {
      updateData.completedAt = new Date();
    } else if (["PENDING", "PROCESSING"].includes(data.status)) {
      updateData.completedAt = null;
    }
  }

  if (!hasChanges) {
    return getExamResultById(id);
  }

  return prisma.examResult.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      notes: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      orderExamId: true,
    },
  });
}

export async function listExamResults(
  filters: ListExamResultsFilters
): Promise<{
  data: ExamResultResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1);
  const limit = Math.max(1, Math.min(Number.isInteger(filters.limit) && filters.limit! > 0 ? filters.limit! : 20, 100));
  const skip = (page - 1) * limit;

  const relationFilters: Prisma.ExamResultWhereInput[] = [];

if (filters.dentistId !== undefined) {
  relationFilters.push({
    orderExam: {
      order: {
        dentistId: filters.dentistId,
      },
    },
  });
}

if (filters.radiologyCenterIds !== undefined) {
  relationFilters.push({
    orderExam: {
      order: {
        radiologyCenterId: {
          in: filters.radiologyCenterIds,
        },
      },
    },
  });
}

const where: Prisma.ExamResultWhereInput = {
  ...(filters.orderExamId && { orderExamId: filters.orderExamId }),
  ...(filters.status && { status: filters.status as any }),
  ...(relationFilters.length > 0 && { AND: relationFilters }),
};

  const [data, total] = await Promise.all([
    prisma.examResult.findMany({
      where,
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        notes: true,
        status: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        orderExamId: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.examResult.count({ where }),
  ]);

  return {
    data: data as ExamResultResponse[],
    total,
    page,
    limit,
  };
}