import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExamResult,
  getExamResultById,
  getExamResultByOrderExamId,
  updateExamResult,
  listExamResults,
  type ExamResultResponse,
  type CreateExamResultInput,
  type UpdateExamResultInput,
} from "./exam-result-service";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

type MockExamResultResponse = {
  id: string;
  fileUrl: string | null;
  fileType: string | null;
  notes: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REVIEWED";
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  orderExamId: string;
};

vi.mock("../prisma/client", () => ({
  default: {
    examResult: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orderExam: {
      findUnique: vi.fn(),
    },
  },
}));

const mockOrderExam = {
  id: "order-exam-1",
  orderId: "order-1",
  examId: "exam-1",
  status: "PENDING",
  order: {
    id: "order-1",
    dentistId: "dentist-1",
    radiologyCenterId: "center-1",
  },
};

const mockExamResult: MockExamResultResponse = {
  id: "result-1",
  fileUrl: "https://example.com/result.pdf",
  fileType: "application/pdf",
  notes: "Normal findings",
  status: "COMPLETED",
  completedAt: new Date("2026-01-15"),
  createdAt: new Date("2026-01-10"),
  updatedAt: new Date("2026-01-15"),
  orderExamId: "order-exam-1",
};

describe("Exam Result Service - createExamResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería crear un resultado exitosamente", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(mockOrderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue(mockExamResult as any);

    const input: CreateExamResultInput = {
      orderExamId: "order-exam-1",
      fileUrl: "https://example.com/result.pdf",
      fileType: "application/pdf",
      notes: "Normal findings",
      status: "COMPLETED",
    };

    const result = await createExamResult(input);

    expect(result).toEqual(mockExamResult);
    expect(prisma.orderExam.findUnique).toHaveBeenCalledWith({
      where: { id: "order-exam-1" },
      select: expect.objectContaining({
        id: true,
        orderId: true,
        examId: true,
        status: true,
        order: expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            dentistId: true,
            radiologyCenterId: true,
          }),
        }),
      }),
    });
    expect(prisma.examResult.findUnique).toHaveBeenCalledWith({
      where: { orderExamId: "order-exam-1" },
      select: { id: true },
    });
    expect(prisma.examResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileUrl: "https://example.com/result.pdf",
        fileType: "application/pdf",
        notes: "Normal findings",
        status: "COMPLETED",
        orderExamId: "order-exam-1",
      }),
      select: expect.any(Object),
    });
  });

  it("debería usar status PENDING por defecto", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(mockOrderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue({
      ...mockExamResult,
      status: "PENDING",
      completedAt: null,
    } as any);

    const input: CreateExamResultInput = {
      orderExamId: "order-exam-1",
      fileUrl: "https://example.com/result.pdf",
    };

    const result = await createExamResult(input);

    expect(result.status).toBe("PENDING");
    expect(result.completedAt).toBeNull();
  });

  it("debería establecer completedAt automáticamente para COMPLETED", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(mockOrderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue(mockExamResult as any);

    const input: CreateExamResultInput = {
      orderExamId: "order-exam-1",
      fileUrl: "https://example.com/result.pdf",
      status: "COMPLETED",
    };

    await createExamResult(input);

    expect(prisma.examResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("debería lanzar error si OrderExam no existe", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(null);

    const input: CreateExamResultInput = {
      orderExamId: "non-existent",
      fileUrl: "https://example.com/result.pdf",
    };

    await expect(createExamResult(input)).rejects.toThrow("ORDER_EXAM_NOT_FOUND");
  });

  it("debería lanzar error si ya existe un resultado para el OrderExam", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(mockOrderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(mockExamResult as any);

    const input: CreateExamResultInput = {
      orderExamId: "order-exam-1",
      fileUrl: "https://example.com/result.pdf",
    };

    await expect(createExamResult(input)).rejects.toThrow("EXAM_RESULT_ALREADY_EXISTS");
  });
});

describe("Exam Result Service - getExamResultById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería obtener un resultado por ID", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(mockExamResult as any);

    const result = await getExamResultById("result-1");

    expect(result).toEqual(mockExamResult);
    expect(prisma.examResult.findUnique).toHaveBeenCalledWith({
      where: { id: "result-1" },
      select: expect.any(Object),
    });
  });

  it("debería retornar null si no existe", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);

    const result = await getExamResultById("non-existent");

    expect(result).toBeNull();
  });
});

describe("Exam Result Service - getExamResultByOrderExamId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería obtener un resultado por OrderExamId", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(mockExamResult as any);

    const result = await getExamResultByOrderExamId("order-exam-1");

    expect(result).toEqual(mockExamResult);
    expect(prisma.examResult.findUnique).toHaveBeenCalledWith({
      where: { orderExamId: "order-exam-1" },
      select: expect.any(Object),
    });
  });

  it("debería retornar null si no existe", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);

    const result = await getExamResultByOrderExamId("non-existent");

    expect(result).toBeNull();
  });
});

describe("Exam Result Service - updateExamResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería actualizar campos proporcionados", async () => {
    const updatedResult = {
      ...mockExamResult,
      fileUrl: "https://example.com/new-result.pdf",
      notes: "Updated notes",
    };

    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(mockExamResult as any);
    vi.mocked(prisma.examResult.update).mockResolvedValue(updatedResult as any);

    const input: UpdateExamResultInput = {
      fileUrl: "https://example.com/new-result.pdf",
      notes: "Updated notes",
    };

    const result = await updateExamResult("result-1", input);

    expect(result).toEqual(updatedResult);
    expect(prisma.examResult.update).toHaveBeenCalledWith({
      where: { id: "result-1" },
      data: expect.objectContaining({
        fileUrl: "https://example.com/new-result.pdf",
        notes: "Updated notes",
      }),
      select: expect.any(Object),
    });
  });

  it("debería establecer completedAt al cambiar a COMPLETED si no existe", async () => {
    const pendingResult = { ...mockExamResult, status: "PENDING", completedAt: null };
    const completedResult = { ...mockExamResult, status: "COMPLETED", completedAt: new Date("2026-01-20") };

    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(pendingResult as any);
    vi.mocked(prisma.examResult.update).mockResolvedValue(completedResult as any);

    const input: UpdateExamResultInput = { status: "COMPLETED" };

    const result = await updateExamResult("result-1", input);

    expect(result!.status).toBe("COMPLETED");
    expect(result!.completedAt).not.toBeNull();
    expect(prisma.examResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("debería limpiar completedAt al cambiar a PENDING", async () => {
    const completedResult = { ...mockExamResult, status: "COMPLETED", completedAt: new Date("2026-01-15") };
    const pendingResult = { ...mockExamResult, status: "PENDING", completedAt: null };

    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(completedResult as any);
    vi.mocked(prisma.examResult.update).mockResolvedValue(pendingResult as any);

    const input: UpdateExamResultInput = { status: "PENDING" };

    const result = await updateExamResult("result-1", input);

    expect(result!.status).toBe("PENDING");
    expect(result!.completedAt).toBeNull();
    expect(prisma.examResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          completedAt: null,
        }),
      })
    );
  });

  it("debería retornar el resultado existente si no hay cambios", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(mockExamResult as any);

    const input: UpdateExamResultInput = {};

    const result = await updateExamResult("result-1", input);

    expect(result).toEqual(mockExamResult);
    expect(prisma.examResult.update).not.toHaveBeenCalled();
  });

  it("debería retornar null si el resultado no existe", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);

    const input: UpdateExamResultInput = { notes: "New notes" };

    const result = await updateExamResult("non-existent", input);

    expect(result).toBeNull();
    expect(prisma.examResult.update).not.toHaveBeenCalled();
  });

  it("debería retornar resultado existente sin actualizar si status es el mismo", async () => {
    const existingCompletedAt = new Date("2026-01-10");
    const completedResult = { ...mockExamResult, status: "COMPLETED", completedAt: existingCompletedAt };

    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(completedResult as any);

    const input: UpdateExamResultInput = { status: "COMPLETED" };

    const result = await updateExamResult("result-1", input);

    expect(result).toEqual(completedResult);
    expect(prisma.examResult.update).not.toHaveBeenCalled();
  });
});

describe("Exam Result Service - listExamResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería listar resultados con paginación por defecto", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([mockExamResult] as any);
    vi.mocked(prisma.examResult.count).mockResolvedValue(1);

    const result = await listExamResults({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("debería normalizar page y limit inválidos", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    const result = await listExamResults({ page: -1, limit: 150 });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it("debería filtrar por orderExamId", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([mockExamResult] as any);
    vi.mocked(prisma.examResult.count).mockResolvedValue(1);

    await listExamResults({ orderExamId: "order-exam-1" });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderExamId: "order-exam-1" }),
      })
    );
  });

  it("debería filtrar por status", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({ status: "COMPLETED" });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("debería ordenar por createdAt descendente", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({});

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("debería calcular skip correctamente", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({ page: 3, limit: 10 });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    );
  });
});

  it("debería filtrar por dentistId a través de las relaciones", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({ dentistId: "dentist-1" });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              orderExam: {
                order: {
                  dentistId: "dentist-1",
                },
              },
            },
          ],
        }),
      })
    );
  });

  it("debería filtrar por varios centros radiológicos", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({
      radiologyCenterIds: ["center-1", "center-2"],
    });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              orderExam: {
                order: {
                  radiologyCenterId: {
                    in: ["center-1", "center-2"],
                  },
                },
              },
            },
          ],
        }),
      })
    );
  });

  it("debería mantener el filtro vacío cuando no hay centros autorizados", async () => {
    vi.mocked(prisma.examResult.findMany).mockResolvedValue([]);
    vi.mocked(prisma.examResult.count).mockResolvedValue(0);

    await listExamResults({ radiologyCenterIds: [] });

    expect(prisma.examResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              orderExam: {
                order: {
                  radiologyCenterId: {
                    in: [],
                  },
                },
              },
            },
          ],
        }),
      })
    );
  });
