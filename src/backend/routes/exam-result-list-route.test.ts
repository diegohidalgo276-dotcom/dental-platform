
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const mocks = vi.hoisted(() => ({
  currentUser: {
    sub: "user-1",
    email: "test@example.com",
    role: "DENTIST",
  },
  listExamResults: vi.fn(),
  dentistFindFirst: vi.fn(),
  centersFindMany: vi.fn(),
  orderExamFindUnique: vi.fn(),
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
      findMany: mocks.centersFindMany,
    },
    orderExam: {
      findUnique: mocks.orderExamFindUnique,
    },
  },
}));

vi.mock("../services/exam-result-service", () => ({
  createExamResult: vi.fn(),
  getExamResultById: vi.fn(),
  getExamResultByOrderExamId: vi.fn(),
  updateExamResult: vi.fn(),
  listExamResults: mocks.listExamResults,
}));

import { registerExamResultRoutes } from "./exam-result-routes";

describe("GET /exam-results - permisos por rol", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
	vi.clearAllMocks();

    mocks.currentUser.sub = "user-1";
    mocks.currentUser.role = "DENTIST";

    mocks.listExamResults.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    mocks.dentistFindFirst.mockResolvedValue({ id: "dentist-1" });

    mocks.centersFindMany.mockResolvedValue([
      { radiologyCenterId: "center-1" },
      { radiologyCenterId: "center-2" },
    ]);
  });

  
  it("filtra los resultados por el dentista autenticado", async () => {
    await registerExamResultRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/exam-results",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.listExamResults).toHaveBeenCalledWith(
      expect.objectContaining({ dentistId: "dentist-1" }),
    );
    expect(mocks.dentistFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
  });

  it("no devuelve resultados sin asociación de dentista", async () => {
    mocks.dentistFindFirst.mockResolvedValue(null);
    await registerExamResultRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/exam-results",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.listExamResults).toHaveBeenCalledWith(
      expect.objectContaining({ dentistId: "" }),
    );
  });

  it("filtra por todos los centros activos asociados al usuario", async () => {
    mocks.currentUser.role = "RADIOLOGY_CENTER_STAFF";
    await registerExamResultRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/exam-results",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.listExamResults).toHaveBeenCalledWith(
      expect.objectContaining({
        radiologyCenterIds: ["center-1", "center-2"],
      }),
    );
    expect(mocks.centersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isActive: true },
      }),
    );
  });

  it("no devuelve resultados si el usuario no tiene centros asociados", async () => {
    mocks.currentUser.role = "RADIOLOGY_CENTER_ADMIN";
    mocks.centersFindMany.mockResolvedValue([]);
    await registerExamResultRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/exam-results",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.listExamResults).toHaveBeenCalledWith(
      expect.objectContaining({ radiologyCenterIds: [] }),
    );
  });

  it("mantiene el acceso general del administrador", async () => {
    mocks.currentUser.role = "ADMIN";
    await registerExamResultRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/exam-results",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.listExamResults).toHaveBeenCalledWith(
      expect.not.objectContaining({
        dentistId: expect.anything(),
        radiologyCenterIds: expect.anything(),
      }),
    );
    expect(mocks.dentistFindFirst).not.toHaveBeenCalled();
    expect(mocks.centersFindMany).not.toHaveBeenCalled();
  });
});
