// Test file for commission service
// Created as part of the commission module completion
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCommissionFromOrderExam,
  generateCommissionsForOrder,
  getCommissionById,
  getCommissionByOrderExamId,
  listCommissions,
  approveCommission,
  cancelCommission,
  type CommissionStatus,
  type CommissionResponse,
  type ApproveCommissionInput,
  type CancelCommissionInput,
  type ListCommissionsFilters,
  type GenerateCommissionResult,
} from "./commission-service";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export type MockCommissionResponse = {
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
  orderExamId: string;
  commissionRuleId: string;
};

vi.mock("../prisma/client", () => ({
  default: {
    commission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn()
    },
    orderExam: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

const mockOrderExam = {
  id: "order-exam-1",
  status: "COMPLETED",
  commissionType: "PERCENTAGE",
  commissionAmount: new Prisma.Decimal("100.00"),
  commissionRuleId: "rule-1",
  orderId: "order-1",
  order: {
    id: "order-1",
    dentistId: "dentist-1",
    radiologyCenterId: "center-1"
  }
};

const mockCommission = {
  id: "commission-1",
  amount: new Prisma.Decimal("100.00"),
  status: "PENDING" as const,
  notes: null,
  approvedAt: null,
  approvedBy: null,
  paidAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  orderExamId: "order-exam-1",
  commissionRuleId: "rule-1"
};

describe("generateCommissionFromOrderExam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(mockOrderExam as any);
    vi.mocked(prisma.commission.findUnique).mockResolvedValue(null);
  });

  it("should generate commission for eligible orderExam", async () => {
    vi.mocked(prisma.commission.create).mockResolvedValue(mockCommission);

    const result = await generateCommissionFromOrderExam("order-exam-1");

    expect(result).toEqual(mockCommission);
    expect(prisma.orderExam.findUnique).toHaveBeenCalledWith({
      where: { id: "order-exam-1" },
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
    expect(prisma.commission.create).toHaveBeenCalledWith({
      data: {
        amount: new Prisma.Decimal("100.00"),
        status: "PENDING",
        orderExamId: "order-exam-1",
        commissionRuleId: "rule-1",
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
  });

  it("should fail if orderExam does not exist", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue(null);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("ORDER_EXAM_NOT_FOUND");
  });

  it("should fail if orderExam is not COMPLETED", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue({
      ...mockOrderExam,
      status: "PENDING"
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("ORDER_EXAM_NOT_COMPLETED");
  });

  it("should fail if commission type is NONE", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue({
      ...mockOrderExam,
      commissionType: "NONE"
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_NOT_ELIGIBLE");
  });

  it("should fail if no commission rule", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue({
      ...mockOrderExam,
      commissionRuleId: null
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_NOT_ELIGIBLE");
  });

  it("should fail if amount is zero", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue({
      ...mockOrderExam,
      commissionAmount: new Prisma.Decimal("0.00")
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_NOT_ELIGIBLE");
  });

  it("should fail if amount is negative", async () => {
    vi.mocked(prisma.orderExam.findUnique).mockResolvedValue({
      ...mockOrderExam,
      commissionAmount: new Prisma.Decimal("-50.00")
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_NOT_ELIGIBLE");
  });

  it("should fail if commission already exists", async () => {
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "existing-1"
    } as any);

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_ALREADY_EXISTS");
  });

  it("should handle Prisma P2002 duplicate error", async () => {
    vi.mocked(prisma.commission.create).mockRejectedValue({ code: "P2002" });

    await expect(generateCommissionFromOrderExam("order-exam-1"))
      .rejects.toThrow("COMMISSION_ALREADY_EXISTS");
  });
});

describe("generateCommissionsForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.orderExam.findMany).mockResolvedValue([
      mockOrderExam as any,
      {
        ...mockOrderExam,
        id: "order-exam-2",
        commissionType: "NONE",
        commissionAmount: new Prisma.Decimal("0.00"),
        commissionRuleId: "rule-1"
      } as any
    ]);
  });

  it("should generate commissions for valid orderExams and skip invalid ones", async () => {
    vi.mocked(prisma.commission.create).mockResolvedValue(mockCommission);
vi.mocked(prisma.orderExam.findUnique as any).mockImplementation(({ where }: { where: any }) => {
      if (where.id === "order-exam-2") {
        return Promise.resolve({
          ...mockOrderExam,
          id: "order-exam-2",
          commissionType: "NONE",
          commissionAmount: new Prisma.Decimal("0.00"),
          commissionRuleId: "rule-1"
        } as any);
      }
      return Promise.resolve(mockOrderExam as any);
    });
    vi.mocked(prisma.commission.findUnique).mockResolvedValue(null);

    const results = await generateCommissionsForOrder("order-1");

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].commission).toEqual(mockCommission);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe("COMMISSION_NOT_ELIGIBLE");
  });
});

describe("approveCommission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "commission-1",
      status: "PENDING"
    } as any);
  });

  it("should approve a pending commission", async () => {
    const approveInput: ApproveCommissionInput = {
      approvedBy: "user-1",
      notes: "Approved"
    };
    const approvedCommission = {
      ...mockCommission,
      status: "APPROVED" as const,
      approvedAt: new Date(),
      approvedBy: "user-1",
      notes: "Approved"
    };

    vi.mocked(prisma.commission.update).mockResolvedValue(approvedCommission);

    const result = await approveCommission("commission-1", approveInput);

    expect(result?.status).toBe("APPROVED");
    expect(result?.approvedBy).toBe("user-1");
    expect(result?.notes).toBe("Approved");
    expect(prisma.commission.update).toHaveBeenCalledWith({
      where: {
        id: "commission-1",
        status: "PENDING"
      },
      data: {
        status: "APPROVED",
        approvedAt: expect.any(Date),
        approvedBy: "user-1",
        notes: "Approved"
      },
      select: expect.any(Object)
    });
  });

  it("should fail if commission is not PENDING", async () => {
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "commission-1",
      status: "APPROVED"
    } as any);

    await expect(approveCommission("commission-1", { approvedBy: "user-1" }))
      .rejects.toThrow("COMMISSION_CANNOT_BE_APPROVED");
  });

  it("should handle concurrent update error P2025", async () => {
    vi.mocked(prisma.commission.update).mockRejectedValue({ code: "P2025" });

    await expect(approveCommission("commission-1", { approvedBy: "user-1" }))
      .rejects.toThrow("COMMISSION_CONCURRENT_UPDATE");
  });
});

describe("cancelCommission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "commission-1",
      status: "PENDING"
    } as any);
  });

  it("should cancel a pending commission", async () => {
    const cancelInput: CancelCommissionInput = {
      cancelledBy: "user-1",
      cancellationReason: "Test reason"
    };
    const cancelledCommission = {
      ...mockCommission,
      status: "CANCELLED" as const,
      cancelledAt: new Date(),
      cancellationReason: "Test reason"
    };

    vi.mocked(prisma.commission.update).mockResolvedValue(cancelledCommission);

    const result = await cancelCommission("commission-1", cancelInput);

    expect(result?.status).toBe("CANCELLED");
    expect(result?.cancellationReason).toBe("Test reason");
    expect(prisma.commission.update).toHaveBeenCalledWith({
      where: {
        id: "commission-1",
        status: { in: ["PENDING", "APPROVED"] }
      },
      data: {
        status: "CANCELLED",
        cancelledAt: expect.any(Date),
        cancellationReason: "Test reason"
      },
      select: expect.any(Object)
    });
  });

  it("should fail if commission is PAID", async () => {
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "commission-1",
      status: "PAID"
    } as any);

    await expect(cancelCommission("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: "Test reason"
    })).rejects.toThrow("COMMISSION_CANNOT_BE_CANCELLED");
  });

  it("should fail if commission is not PENDING or APPROVED", async () => {
    vi.mocked(prisma.commission.findUnique).mockResolvedValue({
      id: "commission-1",
      status: "CANCELLED"
    } as any);

    await expect(cancelCommission("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: "Test reason"
    })).rejects.toThrow("COMMISSION_CANNOT_BE_CANCELLED");
  });

  it("should fail if cancellation reason is missing", async () => {
    await expect(cancelCommission("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: ""
    })).rejects.toThrow("CANCELLATION_REASON_REQUIRED");

    await expect(cancelCommission("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: "   "
    })).rejects.toThrow("CANCELLATION_REASON_REQUIRED");
  });

  it("should handle concurrent update error P2025", async () => {
    vi.mocked(prisma.commission.update).mockRejectedValue({ code: "P2025" });

    await expect(cancelCommission("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: "Test reason"
    })).rejects.toThrow("COMMISSION_CONCURRENT_UPDATE");
  });
});

describe("listCommissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.commission.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commission.count).mockResolvedValue(0);
  });

  it("should return empty structure when no commissions", async () => {
    const result = await listCommissions({});

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20
    });
  });

  it("should filter by dentistId correctly", async () => {
    await listCommissions({
      dentistId: "dentist-1"
    });

    expect(prisma.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{
            orderExam: {
              order: {
                dentistId: "dentist-1"
              }
            }
          }])
        })
      })
    );
  });

  it("should filter by radiologyCenterId correctly", async () => {
    await listCommissions({
      radiologyCenterId: "center-1"
    });

    expect(prisma.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{
            orderExam: {
              order: {
                radiologyCenterId: "center-1"
              }
            }
          }])
        })
      })
    );
  });
});