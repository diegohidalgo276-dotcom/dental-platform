import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export type ExamPriceResponse = {
  id: string;
  price: Prisma.Decimal;
  isActive: boolean;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  examId: string;
  radiologyCenterId: string;
};

export type CreateExamPriceInput = {
  examId: string;
  radiologyCenterId: string;
  price: number;
  validFrom: Date;
  validTo?: Date | null;
};

export type UpdateExamPriceInput = {
  price?: number;
  validFrom?: Date;
  validTo?: Date | null;
  isActive?: boolean;
};

export async function listExamPrices(): Promise<ExamPriceResponse[]> {
  return prisma.examPrice.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      price: true,
      isActive: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      examId: true,
      radiologyCenterId: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getExamPriceById(id: string): Promise<ExamPriceResponse | null> {
  return prisma.examPrice.findFirst({
    where: {
      id,
      isActive: true
    },
    select: {
      id: true,
      price: true,
      isActive: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      examId: true,
      radiologyCenterId: true
    }
  });
}

export async function createExamPrice(data: CreateExamPriceInput): Promise<ExamPriceResponse> {
  return prisma.examPrice.create({
    data: {
      price: data.price,
      validFrom: data.validFrom,
      validTo: data.validTo || null,
      isActive: true,
      examId: data.examId,
      radiologyCenterId: data.radiologyCenterId
    },
    select: {
      id: true,
      price: true,
      isActive: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      examId: true,
      radiologyCenterId: true
    }
  });
}

export async function updateExamPrice(id: string, data: UpdateExamPriceInput): Promise<ExamPriceResponse | null> {
  const examPrice = await getExamPriceById(id);
  if (!examPrice) {
    return null;
  }

  const updateData: Record<string, unknown> = {};

  if (data.price !== undefined) updateData.price = data.price;
  if (data.validFrom !== undefined) updateData.validFrom = data.validFrom;
  if (data.validTo !== undefined) updateData.validTo = data.validTo;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.examPrice.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      price: true,
      isActive: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      examId: true,
      radiologyCenterId: true
    }
  });
}

export async function deleteExamPrice(id: string): Promise<ExamPriceResponse | null> {
  const examPrice = await getExamPriceById(id);
  if (!examPrice) {
    return null;
  }

  return prisma.examPrice.update({
    where: { id },
    data: {
      isActive: false
    },
    select: {
      id: true,
      price: true,
      isActive: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      updatedAt: true,
      examId: true,
      radiologyCenterId: true
    }
  });
}
