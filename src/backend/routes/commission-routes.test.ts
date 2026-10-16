import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const mocks = vi.hoisted(() => ({
  currentUser: {
    sub: "user-1",
    email: "test@example.com",
    role: "ADMIN",
  },
  listCommissions: vi.fn(),
  getCommissionById: vi.fn(),
  getCommissionByOrderExamId: vi.fn(),
  generateCommissionFromOrderExam: vi.fn(),
  generateCommissionsForOrder: vi.fn(),
  approveCommission: vi.fn(),
  cancelCommission: vi.fn(),
  dentistFindFirst: vi.fn(),
  userRadiologyCenterFindFirst: vi.fn(),
  userRadiologyCenterFindMany: vi.fn(),
  orderExamFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
}));

vi.mock("../middlewares/auth", () => ({
  authenticate: async (request: any) => {
    request.user = { ...mocks.currentUser };
  },
}));

vi.mock("../middlewares/role-guard", () => ({
  requireRoles: () => async () => undefined,
}));

vi.mock("../prisma/client", () => ({
  default: {
    dentist: {
      findFirst: mocks.dentistFindFirst,
    },
    userRadiologyCenter: {
      findFirst: mocks.userRadiologyCenterFindFirst,
      findMany: mocks.userRadiologyCenterFindMany,
    },
    orderExam: {
      findFirst: mocks.orderExamFindFirst,
    },
    order: {
      findFirst: mocks.orderFindFirst,
    },
  },
}));

vi.mock("../services/commission-service", () => ({
  getCommissionById: mocks.getCommissionById,
  getCommissionByOrderExamId: mocks.getCommissionByOrderExamId,
  generateCommissionFromOrderExam: mocks.generateCommissionFromOrderExam,
  generateCommissionsForOrder: mocks.generateCommissionsForOrder,
  approveCommission: mocks.approveCommission,
  cancelCommission: mocks.cancelCommission,
  listCommissions: mocks.listCommissions,
}));

import { registerCommissionRoutes } from "./commission-routes";

const mockCommission = {
  id: "commission-1",
  amount: { toString: () => "100.00" } as any,
  status: "PENDING",
  notes: null,
  approvedAt: null,
  approvedBy: null,
  paidAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  orderExamId: "order-exam-1",
  commissionRuleId: "rule-1",
};

describe("Commission Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.currentUser.sub = "user-1";
    mocks.currentUser.email = "test@example.com";
    mocks.currentUser.role = "ADMIN";

    mocks.listCommissions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    mocks.getCommissionById.mockResolvedValue({
      ...mockCommission,
      orderExamId: "order-exam-1",
    });

    mocks.getCommissionByOrderExamId.mockResolvedValue({
      ...mockCommission,
      orderExamId: "order-exam-1",
    });

    mocks.generateCommissionFromOrderExam.mockResolvedValue({
      ...mockCommission,
    });

    mocks.generateCommissionsForOrder.mockResolvedValue([
      { orderExamId: "order-exam-1", success: true, commission: mockCommission },
    ]);

    mocks.approveCommission.mockResolvedValue({
      ...mockCommission,
      status: "APPROVED",
      approvedBy: "user-1",
    });

    mocks.cancelCommission.mockResolvedValue({
      ...mockCommission,
      status: "CANCELLED",
      cancellationReason: "Test",
    });

    mocks.dentistFindFirst.mockResolvedValue({ id: "dentist-1" });
    mocks.userRadiologyCenterFindFirst.mockResolvedValue({ radiologyCenterId: "center-1" });
    mocks.userRadiologyCenterFindMany.mockResolvedValue([{ radiologyCenterId: "center-1" }]);
    mocks.orderExamFindFirst.mockResolvedValue({
      id: "order-exam-1",
      order: {
        dentistId: "dentist-1",
        radiologyCenterId: "center-1",
      },
    });

    app = Fastify();
    await registerCommissionRoutes(app);
  });

  it("registra las siete rutas sin conflictos de path", async () => {
    await app.ready();
    expect(app.hasRoute({ method: "GET", url: "/commissions" })).toBe(true);
    expect(app.hasRoute({ method: "GET", url: "/commissions/:id" })).toBe(true);
    expect(app.hasRoute({ method: "GET", url: "/commissions/order-exam/:orderExamId" })).toBe(true);
    expect(app.hasRoute({ method: "POST", url: "/commissions/generate/:orderExamId" })).toBe(true);
    expect(app.hasRoute({ method: "POST", url: "/commissions/generate-for-order/:orderId" })).toBe(true);
    expect(app.hasRoute({ method: "PATCH", url: "/commissions/:id/approve" })).toBe(true);
    expect(app.hasRoute({ method: "PATCH", url: "/commissions/:id/cancel" })).toBe(true);
  });

  describe("GET /commissions - Listado", () => {
    it("permite listar como ADMIN", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "GET",
        url: "/commissions",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.listCommissions).toHaveBeenCalled();
    });

    it("permite listar como DENTIST con resolución de identidad", async () => {
      mocks.currentUser.role = "DENTIST";

      const response = await app.inject({
        method: "GET",
        url: "/commissions",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.dentistFindFirst).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: { id: true },
      });
      expect(mocks.listCommissions).toHaveBeenCalledWith(
        expect.objectContaining({ dentistId: "dentist-1" })
      );
    });

    it("impide que DENTIST sobrescriba dentistId con query param", async () => {
      mocks.currentUser.role = "DENTIST";

      const response = await app.inject({
        method: "GET",
        url: "/commissions?dentistId=other-dentist",
      });

      expect(response.statusCode).toBe(200);
      const callArg = mocks.listCommissions.mock.calls[0][0];
      expect(callArg.dentistId).toBe("dentist-1");
    });

    it("permite listar como RADIOLOGY_CENTER_STAFF", async () => {
      mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";

      const response = await app.inject({
        method: "GET",
        url: "/commissions",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.listCommissions).toHaveBeenCalledWith(
        expect.objectContaining({ radiologyCenterId: "center-1" })
      );
    });

    it("impide que RADIOLOGY_CENTER_STAFF sobrescriba radiologyCenterId", async () => {
      mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";

      const response = await app.inject({
        method: "GET",
        url: "/commissions?radiologyCenterId=other-center",
      });

      expect(response.statusCode).toBe(200);
      const callArg = mocks.listCommissions.mock.calls[0][0];
      expect(callArg.radiologyCenterId).toBe("center-1");
    });
  });

  describe("GET /commissions/:id - Detalle", () => {
    it("permite ver comisión como ADMIN", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "GET",
        url: "/commissions/commission-1",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.getCommissionById).toHaveBeenCalledWith("commission-1");
    });

    it("permite DENTIST ver su propia comisión", async () => {
      mocks.currentUser.role = "DENTIST";
      mocks.dentistFindFirst.mockResolvedValue({ id: "dentist-1" });
      mocks.orderExamFindFirst.mockResolvedValue({ id: "order-exam-1" });

      const response = await app.inject({
        method: "GET",
        url: "/commissions/commission-1",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.orderExamFindFirst).toHaveBeenCalledWith({
        where: {
          id: mockCommission.orderExamId,
          order: { dentistId: "dentist-1" },
        },
      });
    });

    it("rechaza DENTIST si la comisión no es suya", async () => {
      mocks.currentUser.role = "DENTIST";
      mocks.dentistFindFirst.mockResolvedValue({ id: "dentist-1" });
      mocks.orderExamFindFirst.mockResolvedValue(null);
      mocks.getCommissionById.mockResolvedValue({
        ...mockCommission,
        orderExamId: "order-exam-1",
      });

      const response = await app.inject({
        method: "GET",
        url: "/commissions/commission-1",
      });

      expect(response.statusCode).toBe(403);
    });

    it("retorna 404 si la comisión no existe", async () => {
      mocks.getCommissionById.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/commissions/commission-1",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /commissions/order-exam/:orderExamId", () => {
    it("permite ver comisión por orderExamId como ADMIN", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "GET",
        url: "/commissions/order-exam/order-exam-1",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.getCommissionByOrderExamId).toHaveBeenCalledWith("order-exam-1");
    });

    it("rechaza si DENTIST intenta ver comisión de otro orderExam", async () => {
      mocks.currentUser.role = "DENTIST";
      mocks.dentistFindFirst.mockResolvedValue({ id: "dentist-1" });
      mocks.orderExamFindFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/commissions/order-exam/order-exam-2",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /commissions/generate/:orderExamId", () => {
    it("permite generar como ADMIN", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate/order-exam-1",
      });

      expect(response.statusCode).toBe(201);
      expect(mocks.generateCommissionFromOrderExam).toHaveBeenCalledWith("order-exam-1");
    });

    it("permite generar como RADIOLOGY_CENTER_ADMIN", async () => {
      mocks.currentUser.role = "RADIOLOGY_CENTER_ADMIN";

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate/order-exam-1",
      });

      expect(response.statusCode).toBe(201);
    });

    it("rechaza generar si el centro no tiene acceso al orderExam", async () => {
      mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";
      mocks.userRadiologyCenterFindFirst.mockResolvedValue({ radiologyCenterId: "center-2" });
      mocks.orderExamFindFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate/order-exam-1",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /commissions/generate-for-order/:orderId", () => {
    it("permite generar para orden como ADMIN", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate-for-order/order-1",
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.generateCommissionsForOrder).toHaveBeenCalledWith("order-1");
    });

    it("rechaza si RADIOLOGY_CENTER no tiene acceso a la orden", async () => {
      mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";
      mocks.userRadiologyCenterFindFirst.mockResolvedValue({ radiologyCenterId: "center-2" });
      mocks.orderFindFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate-for-order/order-1",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /commissions/:id/approve", () => {
    it("usa request.user.sub y no un approvedBy falsificado", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/approve",
        payload: { approvedBy: "attacker", notes: "Approved" },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.approveCommission).toHaveBeenCalledWith("commission-1", {
        approvedBy: "user-1",
        notes: "Approved",
      });
    });

    it("retorna 404 si la comisión no existe (service devuelve null)", async () => {
      mocks.approveCommission.mockResolvedValue(null);

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/approve",
        payload: { approvedBy: "user-1" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /commissions/:id/cancel", () => {
    it("usa request.user.sub y no un cancelledBy falsificado", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/cancel",
        payload: { cancelledBy: "attacker", cancellationReason: "Reason" },
      });

      expect(response.statusCode).toBe(200);
      expect(mocks.cancelCommission).toHaveBeenCalledWith("commission-1", {
        cancelledBy: "user-1",
        cancellationReason: "Reason",
      });
    });

    it("rechaza DENTIST para cancelar", async () => {
      mocks.currentUser.role = "DENTIST";

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/cancel",
        payload: { cancellationReason: "Reason" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("retorna 400 si cancellationReason está vacío", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/cancel",
        payload: { cancelledBy: "user-1", cancellationReason: "" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("retorna 400 si cancellationReason es solo espacios", async () => {
      mocks.currentUser.role = "ADMIN";

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/cancel",
        payload: { cancelledBy: "user-1", cancellationReason: "   " },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it("permite aprobar y cancelar a un usuario del centro autorizado", async () => {
    mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";
    mocks.userRadiologyCenterFindFirst.mockResolvedValue({ id: "link-1" });

    const approveResponse = await app.inject({
      method: "PATCH",
      url: "/commissions/commission-1/approve",
      payload: { approvedBy: "attacker" },
    });
    const cancelResponse = await app.inject({
      method: "PATCH",
      url: "/commissions/commission-1/cancel",
      payload: { cancelledBy: "attacker", cancellationReason: "Reason" },
    });

    expect(approveResponse.statusCode).toBe(200);
    expect(cancelResponse.statusCode).toBe(200);
    expect(mocks.approveCommission).toHaveBeenCalledWith("commission-1", {
      approvedBy: "user-1",
      notes: null,
    });
    expect(mocks.cancelCommission).toHaveBeenCalledWith("commission-1", {
      cancelledBy: "user-1",
      cancellationReason: "Reason",
    });
  });

  it("rechaza aprobar y cancelar desde otro centro", async () => {
    mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";
    mocks.userRadiologyCenterFindFirst.mockResolvedValue(null);
    mocks.userRadiologyCenterFindMany.mockResolvedValue([]);

    const approveResponse = await app.inject({
      method: "PATCH",
      url: "/commissions/commission-1/approve",
      payload: { approvedBy: "user-1" },
    });
    const cancelResponse = await app.inject({
      method: "PATCH",
      url: "/commissions/commission-1/cancel",
      payload: { cancelledBy: "user-1", cancellationReason: "Reason" },
    });

    expect(approveResponse.statusCode).toBe(403);
    expect(cancelResponse.statusCode).toBe(403);
    expect(mocks.approveCommission).not.toHaveBeenCalled();
    expect(mocks.cancelCommission).not.toHaveBeenCalled();
  });

  it("devuelve 404 para aprobación de comisión inexistente", async () => {
    mocks.getCommissionById.mockResolvedValue(null);

    const response = await app.inject({
      method: "PATCH",
      url: "/commissions/commission-1/approve",
      payload: { approvedBy: "user-1" },
    });

    expect(response.statusCode).toBe(404);
    expect(mocks.approveCommission).not.toHaveBeenCalled();
  });

  describe("Error Handling", () => {
    it("mapea COMMISSION_ALREADY_EXISTS a 409", async () => {
      mocks.currentUser.role = "ADMIN";
      mocks.generateCommissionFromOrderExam.mockRejectedValue(new Error("COMMISSION_ALREADY_EXISTS"));

      const response = await app.inject({
        method: "POST",
        url: "/commissions/generate/order-exam-1",
      });

      expect(response.statusCode).toBe(409);
    });

    it("mapea COMMISSION_CONCURRENT_UPDATE a 409", async () => {
      mocks.currentUser.role = "ADMIN";
      mocks.approveCommission.mockRejectedValue(new Error("COMMISSION_CONCURRENT_UPDATE"));

      const response = await app.inject({
        method: "PATCH",
        url: "/commissions/commission-1/approve",
        payload: { approvedBy: "user-1" },
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
