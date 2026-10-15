import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

describe("Exam Result Routes - Middleware Tests", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;

  beforeEach(() => {
    mockRequest = {
      jwtVerify: vi.fn(),
    } as unknown as FastifyRequest;

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;
  });

  describe("authenticate middleware", () => {
    it("debería rechazar una solicitud sin token con 401", async () => {
      vi.mocked(mockRequest.jwtVerify).mockRejectedValue(new Error("Token not found"));

      await authenticate(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "No autorizado" });
    });

    it("debería rechazar un token inválido con 401", async () => {
      vi.mocked(mockRequest.jwtVerify).mockRejectedValue(new Error("Invalid token"));

      await authenticate(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "No autorizado" });
    });

    it("debería aceptar un token válido y permitir continuar", async () => {
      vi.mocked(mockRequest.jwtVerify).mockResolvedValue(undefined);

      const result = await authenticate(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });

  type UserWithRole = {
    sub: string;
    email: string;
    role: "ADMIN" | "RADIOLOGY_CENTER_ADMIN" | "RADIOLOGY_CENTER_STAFF" | "DENTIST";
  };

  const createMockRequest = (role: UserWithRole["role"]): FastifyRequest => {
    return {
      user: {
        sub: "user-1",
        email: "test@example.com",
        role,
      },
    } as unknown as FastifyRequest;
  };

  describe("requireRoles middleware for exam-results", () => {
    beforeEach(() => {
      mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;
    });

    it("debería rechazar DENTIST para POST /exam-results (solo staff/admin)", async () => {
      mockRequest = createMockRequest("DENTIST");
      const allowStaff = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      await allowStaff(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Acceso prohibido" });
    });

    it("debería aceptar RADIOLOGY_CENTER_STAFF para POST /exam-results", async () => {
      mockRequest = createMockRequest("RADIOLOGY_CENTER_STAFF");
      const allowStaff = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      const result = await allowStaff(mockRequest, mockReply);

      expect(result).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it("debería aceptar RADIOLOGY_CENTER_ADMIN para POST /exam-results", async () => {
      mockRequest = createMockRequest("RADIOLOGY_CENTER_ADMIN");
      const allowStaff = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      const result = await allowStaff(mockRequest, mockReply);

      expect(result).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it("debería aceptar ADMIN para POST /exam-results", async () => {
      mockRequest = createMockRequest("ADMIN");
      const allowStaff = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      const result = await allowStaff(mockRequest, mockReply);

      expect(result).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it("debería aceptar DENTIST para GET /exam-results/:id", async () => {
      mockRequest = createMockRequest("DENTIST");
      const allowRead = requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      const result = await allowRead(mockRequest, mockReply);

      expect(result).toBeUndefined();
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it("debería rechazar DENTIST para PATCH /exam-results/:id", async () => {
      mockRequest = createMockRequest("DENTIST");
      const allowPatch = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"]);
      await allowPatch(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Acceso prohibido" });
    });
  });
});

describe("Exam Result Routes - Validation Helpers", () => {
  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  function isValidStatus(status: string): status is "PENDING" | "PROCESSING" | "COMPLETED" | "REVIEWED" {
    return ["PENDING", "PROCESSING", "COMPLETED", "REVIEWED"].includes(status);
  }

  it("debería validar URLs correctas", () => {
    expect(isValidUrl("https://example.com/file.pdf")).toBe(true);
    expect(isValidUrl("http://localhost:3000/uploads/result.dcm")).toBe(true);
    expect(isValidUrl("https://storage.example.com/bucket/result.pdf")).toBe(true);
  });

  it("debería rechazar URLs inválidas", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("debería validar status correctos", () => {
    expect(isValidStatus("PENDING")).toBe(true);
    expect(isValidStatus("PROCESSING")).toBe(true);
    expect(isValidStatus("COMPLETED")).toBe(true);
    expect(isValidStatus("REVIEWED")).toBe(true);
  });

  it("debería rechazar status inválidos", () => {
    expect(isValidStatus("INVALID")).toBe(false);
    expect(isValidStatus("DONE")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("pending")).toBe(false);
  });
});