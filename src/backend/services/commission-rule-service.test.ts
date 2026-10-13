import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCommissionRules,
  getCommissionRuleById,
  createCommissionRuleInTx,
  updateCommissionRuleInTx,
  deleteCommissionRule,
  type CommissionRuleResponse,
  type CreateCommissionRuleInput,
  type UpdateCommissionRuleInput
} from "./commission-rule-service";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

type MockCommissionRuleResponse = {
  id: string;
  commissionType: "PERCENTAGE" | "FIXED" | "NONE";
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

vi.mock("../prisma/client", () => ({
  default: {
    commissionRule: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

const mockCommissionRule: MockCommissionRuleResponse = {
  id: "rule-1",
  commissionType: "PERCENTAGE",
  percentage: { toString: () => "15.00" } as any,
  fixedAmount: null,
  validFrom: new Date("2026-01-01"),
  validTo: null,
  isActive: true,
  priority: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  radiologyCenterId: "center-1",
  examId: "exam-1",
  dentistId: null
};

describe("listCommissionRules - Paginación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.commissionRule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commissionRule.count).mockResolvedValue(0);
  });

  it("debería usar page=1 y limit=20 por defecto cuando no se proporciona", async () => {
    const result = await listCommissionRules({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("debería normalizar limit=-5 a limit=20 (default)", async () => {
    const result = await listCommissionRules({ limit: -5 });

    expect(result.limit).toBe(20);
  });

  it("debería normalizar limit=0 a limit=20 (default)", async () => {
    const result = await listCommissionRules({ limit: 0 });

    expect(result.limit).toBe(20);
  });

  it("debería limitar limit=150 a limit=100 (máximo)", async () => {
    const result = await listCommissionRules({ limit: 150 });

    expect(result.limit).toBe(100);
  });

  it("debería conservar limit=50 válido", async () => {
    const result = await listCommissionRules({ limit: 50 });

    expect(result.limit).toBe(50);
  });

  it("debería normalizar page=-1 a page=1", async () => {
    const result = await listCommissionRules({ page: -1 });

    expect(result.page).toBe(1);
  });

  it("debería normalizar page=0 a page=1", async () => {
    const result = await listCommissionRules({ page: 0 });

    expect(result.page).toBe(1);
  });

  it("debería conservar page=5 válido", async () => {
    const result = await listCommissionRules({ page: 5 });

    expect(result.page).toBe(5);
  });

  it("debería calcular skip correctamente con page=3 y limit=10", async () => {
    await listCommissionRules({ page: 3, limit: 10 });

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10
      })
    );
  });
});

describe("listCommissionRules - Filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.commissionRule.findMany).mockResolvedValue([mockCommissionRule]);
    vi.mocked(prisma.commissionRule.count).mockResolvedValue(1);
  });

  it("debería filtrar por radiologyCenterId", async () => {
    await listCommissionRules({ radiologyCenterId: "center-1" });

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          radiologyCenterId: "center-1"
        })
      })
    );
  });

  it("debería filtrar por examId", async () => {
    await listCommissionRules({ examId: "exam-1" });

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          examId: "exam-1"
        })
      })
    );
  });

  it("debería filtrar por dentistId cuando se proporciona", async () => {
    await listCommissionRules({ dentistId: "dentist-1" });

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dentistId: "dentist-1"
        })
      })
    );
  });

  it("debería filtrar por isActive", async () => {
    await listCommissionRules({ isActive: false });

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: false
        })
      })
    );
  });

  it("debería aplicar ordenamiento correcto", async () => {
    await listCommissionRules({});

    expect(prisma.commissionRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { radiologyCenterId: "asc" },
          { examId: "asc" },
          { dentistId: "asc" },
          { validFrom: "desc" }
        ]
      })
    );
  });

  it("debería devolver estructura correcta con data, total, page y limit", async () => {
    const result = await listCommissionRules({});

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("limit");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });
});

describe("getCommissionRuleById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería obtener una regla por ID", async () => {
    vi.mocked(prisma.commissionRule.findFirst).mockResolvedValue(mockCommissionRule);

    const result = await getCommissionRuleById("rule-1");

    expect(result).toEqual(mockCommissionRule);
    expect(prisma.commissionRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-1" }
      })
    );
  });

  it("debería retornar null cuando la regla no existe", async () => {
    vi.mocked(prisma.commissionRule.findFirst).mockResolvedValue(null);

    const result = await getCommissionRuleById("non-existent");

    expect(result).toBeNull();
  });

  it("debería usar cliente Prisma personalizado si se proporciona", async () => {
    const mockClient = {
      commissionRule: {
        findFirst: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const result = await getCommissionRuleById("rule-1", mockClient);

    expect(result).toEqual(mockCommissionRule);
    expect(mockClient.commissionRule.findFirst).toHaveBeenCalled();
  });
});

describe("createCommissionRuleInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería crear una regla con todos los campos requeridos", async () => {
    const mockTx = {
      commissionRule: {
        create: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const input: CreateCommissionRuleInput = {
      commissionType: "PERCENTAGE",
      percentage: 15,
      validFrom: new Date("2026-01-01"),
      priority: 1,
      radiologyCenterId: "center-1",
      examId: "exam-1"
    };

    const result = await createCommissionRuleInTx(input, mockTx as any);

    expect(result).toEqual(mockCommissionRule);
    expect(mockTx.commissionRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionType: "PERCENTAGE",
          percentage: 15,
          radiologyCenterId: "center-1",
          examId: "exam-1"
        })
      })
    );
  });

  it("debería establecer isActive en true por defecto", async () => {
    const mockTx = {
      commissionRule: {
        create: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const input: CreateCommissionRuleInput = {
      commissionType: "PERCENTAGE",
      percentage: 15,
      validFrom: new Date("2026-01-01"),
      priority: 1,
      radiologyCenterId: "center-1",
      examId: "exam-1"
    };

    await createCommissionRuleInTx(input, mockTx as any);

    expect(mockTx.commissionRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true
        })
      })
    );
  });

  it("debería convertir valores null correctamente para percentage y fixedAmount", async () => {
    const mockTx = {
      commissionRule: {
        create: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const input: CreateCommissionRuleInput = {
      commissionType: "NONE",
      percentage: null,
      fixedAmount: null,
      validFrom: new Date("2026-01-01"),
      priority: 1,
      radiologyCenterId: "center-1",
      examId: "exam-1"
    };

    await createCommissionRuleInTx(input, mockTx as any);

    expect(mockTx.commissionRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          percentage: null,
          fixedAmount: null
        })
      })
    );
  });

  it("debería manejar dentistId como null cuando no se proporciona", async () => {
    const mockTx = {
      commissionRule: {
        create: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const input: CreateCommissionRuleInput = {
      commissionType: "PERCENTAGE",
      percentage: 15,
      validFrom: new Date("2026-01-01"),
      priority: 1,
      radiologyCenterId: "center-1",
      examId: "exam-1"
    };

    await createCommissionRuleInTx(input, mockTx as any);

    expect(mockTx.commissionRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dentistId: null
        })
      })
    );
  });
});

describe("updateCommissionRuleInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería actualizar selectivamente solo campos proporcionados", async () => {
    const mockTx = {
      commissionRule: {
        update: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const updateData: UpdateCommissionRuleInput = {
      percentage: 20
    };

    await updateCommissionRuleInTx("rule-1", updateData, mockTx as any);

    expect(mockTx.commissionRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-1" },
        data: expect.objectContaining({
          percentage: 20
        })
      })
    );
  });

  it("debería retornar regla existente cuando no hay cambios", async () => {
    const mockTx = {
      commissionRule: {
        findFirst: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const updateData: UpdateCommissionRuleInput = {};

    const result = await updateCommissionRuleInTx("rule-1", updateData, mockTx as any);

    expect(result).toEqual(mockCommissionRule);
    expect(mockTx.commissionRule.findFirst).toHaveBeenCalled();
  });

  it("debería actualizar isActive cuando se proporciona", async () => {
    const mockTx = {
      commissionRule: {
        update: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const updateData: UpdateCommissionRuleInput = {
      isActive: false
    };

    await updateCommissionRuleInTx("rule-1", updateData, mockTx as any);

    expect(mockTx.commissionRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false
        })
      })
    );
  });

  it("debería manejar valores null para percentage y fixedAmount", async () => {
    const mockTx = {
      commissionRule: {
        update: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const updateData: UpdateCommissionRuleInput = {
      percentage: null,
      fixedAmount: null
    };

    await updateCommissionRuleInTx("rule-1", updateData, mockTx as any);

    expect(mockTx.commissionRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          percentage: null,
          fixedAmount: null
        })
      })
    );
  });

  it("debería actualizar múltiples campos a la vez", async () => {
    const mockTx = {
      commissionRule: {
        update: vi.fn().mockResolvedValue(mockCommissionRule)
      }
    };

    const updateData: UpdateCommissionRuleInput = {
      commissionType: "FIXED",
      fixedAmount: 100,
      percentage: null,
      isActive: false
    };

    await updateCommissionRuleInTx("rule-1", updateData, mockTx as any);

    expect(mockTx.commissionRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionType: "FIXED",
          fixedAmount: 100,
          percentage: null,
          isActive: false
        })
      })
    );
  });
});

describe("deleteCommissionRule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería marcar regla como isActive=false (soft delete)", async () => {
    vi.mocked(prisma.commissionRule.findFirst).mockResolvedValue(mockCommissionRule);
    vi.mocked(prisma.commissionRule.update).mockResolvedValue({
      ...mockCommissionRule,
      isActive: false
    });

    await deleteCommissionRule("rule-1");

    expect(prisma.commissionRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-1" },
        data: { isActive: false }
      })
    );
  });

  it("debería retornar null si la regla no existe", async () => {
    vi.mocked(prisma.commissionRule.findFirst).mockResolvedValue(null);

    const result = await deleteCommissionRule("non-existent");

    expect(result).toBeNull();
    expect(prisma.commissionRule.update).not.toHaveBeenCalled();
  });

  it("debería llamar a getCommissionRuleById primero para verificar existencia", async () => {
    vi.mocked(prisma.commissionRule.findFirst).mockResolvedValue(mockCommissionRule);
    vi.mocked(prisma.commissionRule.update).mockResolvedValue({
      ...mockCommissionRule,
      isActive: false
    });

    await deleteCommissionRule("rule-1");

    expect(prisma.commissionRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-1" }
      })
    );
  });
});