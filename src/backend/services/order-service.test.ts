import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder, getOrderById, listOrders } from "../services/order-service";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

vi.mock("../prisma/client", () => ({
  default: {
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn()
    },
    orderExam: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    sequence: {
      upsert: vi.fn(),
      update: vi.fn()
    },
    examPrice: {
      findFirst: vi.fn()
    },
    commissionRule: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn((callback) => callback({
      order: {
        create: vi.fn(),
        findUnique: vi.fn()
      },
      orderExam: {
        create: vi.fn()
      },
      sequence: {
        upsert: vi.fn()
      },
      examPrice: {
        findFirst: vi.fn()
      },
      commissionRule: {
        findFirst: vi.fn()
      }
    }))
  }
}));

const mockExamPrice = {
  price: new Prisma.Decimal("100.00")
};

const mockCommissionRulePercentage = {
  id: "rule-1",
  commissionType: "PERCENTAGE",
  percentage: new Prisma.Decimal("15.00"),
  fixedAmount: null
};

const mockCommissionRuleNone = null;

describe("Order Service - createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería crear una orden con exámenes y generar orderNumber secuencial", async () => {
    const mockTx = {
      sequence: {
        upsert: vi.fn().mockResolvedValue({
          currentValue: 1n
        })
      },
      order: {
        create: vi.fn().mockResolvedValue({
          id: "order-1",
          orderNumber: "ORD-000001",
          status: "PENDING",
          totalAmount: new Prisma.Decimal("100.00"),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          patientId: "patient-1",
          dentistId: "dentist-1",
          radiologyCenterId: "center-1",
          patient: {
            id: "patient-1",
            name: "John Doe",
            email: "john@example.com",
            phone: "1234567890"
          },
          dentist: {
            id: "dentist-1",
            name: "Dr. Smith",
            email: "smith@example.com"
          },
          radiologyCenter: {
            id: "center-1",
            name: "Radiology Center"
          }
        })
      },
      orderExam: {
        create: vi.fn().mockResolvedValue({
          id: "order-exam-1",
          quantity: 1,
          unitPrice: new Prisma.Decimal("100.00"),
          discount: new Prisma.Decimal("0.00"),
          subtotal: new Prisma.Decimal("100.00"),
          commissionType: "PERCENTAGE",
          commissionValue: new Prisma.Decimal("15.00"),
          commissionAmount: new Prisma.Decimal("15.00"),
          status: "PENDING",
          exam: {
            id: "exam-1",
            name: "Radiografía",
            code: "RAD001"
          }
        })
      },
      examPrice: {
        findFirst: vi.fn().mockResolvedValue(mockExamPrice)
      },
      commissionRule: {
        findFirst: vi.fn().mockResolvedValue(mockCommissionRulePercentage)
      }
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return callback(mockTx as any);
    });

    const result = await createOrder({
      patientId: "patient-1",
      dentistId: "dentist-1",
      radiologyCenterId: "center-1",
      orderExams: [
        {
          examId: "exam-1",
          quantity: 1,
          discount: 0
        }
      ]
    });

    expect(result.orderNumber).toBe("ORD-000001");
    expect(result.status).toBe("PENDING");
    expect(result.totalAmount).toEqual(new Prisma.Decimal("100.00"));
    expect(result.orderExams).toHaveLength(1);
    expect(result.orderExams[0].commissionType).toBe("PERCENTAGE");
  });

  it("debería permitir examen sin comisión cuando no existe CommissionRule", async () => {
    const mockTx = {
      sequence: {
        upsert: vi.fn().mockResolvedValue({
          currentValue: 2n
        })
      },
      order: {
        create: vi.fn().mockResolvedValue({
          id: "order-2",
          orderNumber: "ORD-000002",
          status: "PENDING",
          totalAmount: new Prisma.Decimal("100.00"),
          notes: "Sin comisión",
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          patientId: "patient-1",
          dentistId: "dentist-1",
          radiologyCenterId: "center-1",
          patient: { id: "patient-1", name: "John", email: null, phone: null },
          dentist: { id: "dentist-1", name: "Dr. Smith", email: "smith@example.com" },
          radiologyCenter: { id: "center-1", name: "Radiology Center" }
        })
      },
      orderExam: {
        create: vi.fn().mockResolvedValue({
          id: "order-exam-2",
          quantity: 1,
          unitPrice: new Prisma.Decimal("100.00"),
          discount: new Prisma.Decimal("0.00"),
          subtotal: new Prisma.Decimal("100.00"),
          commissionType: "NONE",
          commissionValue: new Prisma.Decimal("0.00"),
          commissionAmount: new Prisma.Decimal("0.00"),
          status: "PENDING",
          exam: { id: "exam-1", name: "Radiografía", code: null }
        })
      },
      examPrice: {
        findFirst: vi.fn().mockResolvedValue(mockExamPrice)
      },
      commissionRule: {
        findFirst: vi.fn().mockResolvedValue(mockCommissionRuleNone)
      }
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return callback(mockTx as any);
    });

    const result = await createOrder({
      patientId: "patient-1",
      dentistId: "dentist-1",
      radiologyCenterId: "center-1",
      notes: "Sin comisión",
      orderExams: [
        {
          examId: "exam-1",
          quantity: 1
        }
      ]
    });

    expect(result.orderExams[0].commissionType).toBe("NONE");
    expect(result.orderExams[0].commissionValue).toEqual(new Prisma.Decimal("0.00"));
    expect(result.orderExams[0].commissionAmount).toEqual(new Prisma.Decimal("0.00"));
  });
});

describe("Order Service - getOrderById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería retornar orden con exámenes por ID", async () => {
    const mockOrder = {
      id: "order-1",
      orderNumber: "ORD-000001",
      status: "PENDING",
      totalAmount: new Prisma.Decimal("100.00"),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      patientId: "patient-1",
      dentistId: "dentist-1",
      radiologyCenterId: "center-1",
      patient: { id: "patient-1", name: "John", email: null, phone: null },
      dentist: { id: "dentist-1", name: "Dr. Smith", email: "smith@example.com" },
      radiologyCenter: { id: "center-1", name: "Radiology Center" },
      orderExams: [
        {
          id: "order-exam-1",
          quantity: 1,
          unitPrice: new Prisma.Decimal("100.00"),
          discount: new Prisma.Decimal("0.00"),
          subtotal: new Prisma.Decimal("100.00"),
          commissionType: "PERCENTAGE",
          commissionValue: new Prisma.Decimal("15.00"),
          commissionAmount: new Prisma.Decimal("15.00"),
          status: "PENDING",
          exam: { id: "exam-1", name: "Radiografía", code: "RAD001" }
        }
      ]
    };

    vi.mocked(prisma.order.findFirst).mockResolvedValue(mockOrder as any);

    const result = await getOrderById("order-1");

    expect(result).toEqual(mockOrder);
    expect(result?.orderExams).toHaveLength(1);
  });

  it("debería retornar null si la orden no existe", async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

    const result = await getOrderById("non-existent");

    expect(result).toBeNull();
  });
});

describe("Order Service - listOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería listar órdenes con paginación", async () => {
    const mockOrders = [
      {
        id: "order-1",
        orderNumber: "ORD-000001",
        status: "PENDING",
        totalAmount: new Prisma.Decimal("100.00"),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        patientId: "patient-1",
        dentistId: "dentist-1",
        radiologyCenterId: "center-1"
      }
    ];

    vi.mocked(prisma.order.findMany).mockResolvedValue(mockOrders as any);
    vi.mocked(prisma.order.count).mockResolvedValue(1);

    const result = await listOrders({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("debería filtrar órdenes por dentistId", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.count).mockResolvedValue(0);

    await listOrders({ dentistId: "dentist-1" });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dentistId: "dentist-1"
        })
      })
    );
  });

  it("debería filtrar órdenes por status", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.count).mockResolvedValue(0);

    await listOrders({ status: "PENDING" });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING"
        })
      })
    );
  });
});
