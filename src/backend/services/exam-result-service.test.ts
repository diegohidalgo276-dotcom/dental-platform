import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExamResult,
  getExamResultById,
  getExamResultByOrderExamId,
  updateExamResult,
  listExamResults,
} from "./exam-result-service";
import prisma from "../prisma/client";

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
      update: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const orderExam = {
  id: "order-exam-1",
  orderId: "order-1",
  examId: "exam-1",
  status: "PENDING",
  order: { id: "order-1", dentistId: "dentist-1", radiologyCenterId: "center-1" },
};

const result = {
  id: "result-1",
  fileUrl: "https://example.com/result.pdf",
  fileType: "application/pdf",
  notes: "Notes",
  status: "COMPLETED",
  completedAt: new Date("2026-01-15"),
  createdAt: new Date("2026-01-10"),
  updatedAt: new Date("2026-01-15"),
  orderExamId: "order-exam-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.orderExam.update).mockResolvedValue({ orderId: "order-1" } as any);
  vi.mocked(prisma.orderExam.findMany).mockResolvedValue([{ status: "COMPLETED" }] as any);
  vi.mocked(prisma.order.update).mockResolvedValue({ id: "order-1" } as any);
});

describe("Exam Result Service", () => {
  it("crea un resultado y usa PENDING por defecto", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(orderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue({ ...result, status: "PENDING", completedAt: null } as any);

    const response = await createExamResult({ orderExamId: "order-exam-1", fileUrl: result.fileUrl });

    expect(response.status).toBe("PENDING");
    expect(prisma.orderExam.update).not.toHaveBeenCalled();
  });

  it.each(["COMPLETED", "REVIEWED"] as const)("crea %s y completa OrderExam y Order", async (status) => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(orderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue({ ...result, status } as any);

    await createExamResult({ orderExamId: "order-exam-1", fileUrl: result.fileUrl, status });

    expect(prisma.orderExam.update).toHaveBeenCalledWith({
      where: { id: "order-exam-1" },
      data: { status: "COMPLETED" },
    });
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "COMPLETED", completedAt: expect.any(Date) }),
    }));
  });

  it("no completa Order si queda un OrderExam pendiente", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(orderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.examResult.create).mockResolvedValue(result as any);
    vi.mocked(prisma.orderExam.findMany).mockResolvedValue([{ status: "COMPLETED" }, { status: "PENDING" }] as any);

    await createExamResult({ orderExamId: "order-exam-1", fileUrl: result.fileUrl, status: "COMPLETED" });

    expect(prisma.orderExam.update).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("rechaza OrderExam inexistente y resultado duplicado", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(null);
    await expect(createExamResult({ orderExamId: "missing", fileUrl: result.fileUrl })).rejects.toThrow("ORDER_EXAM_NOT_FOUND");

    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(orderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(result as any);
    await expect(createExamResult({ orderExamId: "order-exam-1", fileUrl: result.fileUrl })).rejects.toThrow("EXAM_RESULT_ALREADY_EXISTS");
  });

  it.each(["COMPLETED", "REVIEWED"] as const)("actualiza a %s y sincroniza estados", async (status) => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue({ ...result, status: "PROCESSING", completedAt: null } as any);
    vi.mocked(prisma.examResult.update).mockResolvedValue({ ...result, status } as any);

    await updateExamResult("result-1", { status });

    expect(prisma.examResult.update).toHaveBeenCalled();
    expect(prisma.orderExam.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "COMPLETED" } }));
    expect(prisma.order.update).toHaveBeenCalled();
  });

  it("no revierte estados al volver a PROCESSING", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(result as any);
    vi.mocked(prisma.examResult.update).mockResolvedValue({ ...result, status: "PROCESSING", completedAt: null } as any);

    await updateExamResult("result-1", { status: "PROCESSING" });

    expect(prisma.examResult.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ completedAt: null }) }));
    expect(prisma.orderExam.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("devuelve null si el resultado no existe y el existente si no hay cambios", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValueOnce(null);
    expect(await updateExamResult("missing", { notes: "x" })).toBeNull();

    vi.mocked(prisma.examResult.findUnique).mockResolvedValueOnce(result as any);
    expect(await updateExamResult("result-1", {})).toEqual(result);
  });

  it("propaga errores transaccionales de creación y actualización", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(orderExam as any);
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("TRANSACTION_FAILED"));

    await expect(createExamResult({ orderExamId: "order-exam-1", fileUrl: result.fileUrl, status: "COMPLETED" })).rejects.toThrow("TRANSACTION_FAILED");

    vi.mocked(prisma.examResult.findUnique).mockResolvedValue({ ...result, status: "PROCESSING" } as any);
    await expect(updateExamResult("result-1", { status: "COMPLETED" })).rejects.toThrow("TRANSACTION_FAILED");
  });

  it("consulta por ID, por OrderExam y lista con paginación y filtros", async () => {
    vi.mocked(prisma.examResult.findUnique).mockResolvedValue(result as any);
    expect(await getExamResultById("result-1")).toEqual(result);
    expect(await getExamResultByOrderExamId("order-exam-1")).toEqual(result);

    vi.mocked(prisma.examResult.findMany).mockResolvedValue([result] as any);
    vi.mocked(prisma.examResult.count).mockResolvedValue(1);
    const response = await listExamResults({ dentistId: "dentist-1", status: "COMPLETED", page: 2, limit: 10 });
    expect(response).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(prisma.examResult.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });
});
