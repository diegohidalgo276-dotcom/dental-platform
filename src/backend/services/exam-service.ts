import prisma from "../prisma/client";

export type ExamResponse = {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateExamInput = {
  name: string;
  description?: string;
  code?: string;
};

export type UpdateExamInput = {
  name?: string;
  description?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export async function listExams(): Promise<ExamResponse[]> {
  return prisma.exam.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getExamById(id: string): Promise<ExamResponse | null> {
  return prisma.exam.findFirst({
    where: {
      id,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createExam(data: CreateExamInput): Promise<ExamResponse> {
  return prisma.exam.create({
    data: {
      name: data.name,
      description: data.description || null,
      code: data.code || null,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updateExam(id: string, data: UpdateExamInput): Promise<ExamResponse | null> {
  const exam = await getExamById(id);
  if (!exam) {
    return null;
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.exam.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function deleteExam(id: string): Promise<ExamResponse | null> {
  const exam = await getExamById(id);
  if (!exam) {
    return null;
  }

  return prisma.exam.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false
    },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
