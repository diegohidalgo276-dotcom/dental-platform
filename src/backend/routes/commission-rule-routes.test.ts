import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

describe("authenticate middleware", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;

  beforeEach(() => {
    mockRequest = {
      jwtVerify: vi.fn()
    } as unknown as FastifyRequest;

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    } as unknown as FastifyReply;
  });

  it("debería rechazar una solicitud sin token con 401", async () => {
    vi.mocked(mockRequest.jwtVerify).mockRejectedValue(new Error("Token not found"));

    await authenticate(mockRequest, mockReply);

    expect(mockRequest.jwtVerify).toHaveBeenCalled();
    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "No autorizado"
    });
  });

  it("debería rechazar un token inválido con 401", async () => {
    vi.mocked(mockRequest.jwtVerify).mockRejectedValue(new Error("Invalid token"));

    await authenticate(mockRequest, mockReply);

    expect(mockRequest.jwtVerify).toHaveBeenCalled();
    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "No autorizado"
    });
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

describe("requireRoles middleware", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;

  const createMockRequest = (role: UserWithRole["role"]): FastifyRequest => {
    return {
      user: {
        sub: "user-1",
        email: "test@example.com",
        role
      }
    } as unknown as FastifyReply as unknown as FastifyRequest;
  };

  beforeEach(() => {
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    } as unknown as FastifyReply;
  });

  it("debería rechazar el rol DENTIST con 403", async () => {
    mockRequest = createMockRequest("DENTIST");

    const allowDentist = requireRoles(["ADMIN"]);
    await allowDentist(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Acceso prohibido"
    });
  });

  it("debería rechazar el rol RADIOLOGY_CENTER_ADMIN con 403", async () => {
    mockRequest = createMockRequest("RADIOLOGY_CENTER_ADMIN");

    const allowDentist = requireRoles(["ADMIN"]);
    await allowDentist(mockRequest, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Acceso prohibido"
    });
  });

  it("debería aceptar el rol ADMIN y permitir continuar", async () => {
    mockRequest = createMockRequest("ADMIN");

    const allowAdmin = requireRoles(["ADMIN"]);
    const result = await allowAdmin(mockRequest, mockReply);

    expect(result).toBeUndefined();
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it("debería aceptar múltiples roles permitidos", async () => {
    mockRequest = createMockRequest("RADIOLOGY_CENTER_ADMIN");

    const allowMultiple = requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN"]);
    const result = await allowMultiple(mockRequest, mockReply);

    expect(result).toBeUndefined();
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });

  it("debería aceptar el rol RADIOLOGY_CENTER_STAFF cuando está en la lista", async () => {
    mockRequest = createMockRequest("RADIOLOGY_CENTER_STAFF");

    const allowStaff = requireRoles(["RADIOLOGY_CENTER_STAFF"]);
    const result = await allowStaff(mockRequest, mockReply);

    expect(result).toBeUndefined();
    expect(mockReply.code).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });
});
