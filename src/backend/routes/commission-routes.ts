import { FastifyInstance } from "fastify";
import {
  generateCommissionFromOrderExam,
  generateCommissionsForOrder,
  getCommissionById,
  getCommissionByOrderExamId,
  listCommissions,
  approveCommission,
  cancelCommission,
  type ListCommissionsFilters,
  type ApproveCommissionInput,
  type CancelCommissionInput
} from "../services/commission-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";
import prisma from "../prisma/client";

async function getAuthorizedCenterIds(userId: string): Promise<string[]> {
  const centers = await prisma.userRadiologyCenter.findMany({
    where: { userId, isActive: true },
    select: { radiologyCenterId: true }
  });

  return [...new Set(centers.map((center) => center.radiologyCenterId))];
}

async function listForAuthorizedCenters(
  filters: ListCommissionsFilters,
  centerIds: string[]
) {
  const perCenter = await Promise.all(
    centerIds.map(async (radiologyCenterId) => {
      const rows: Awaited<ReturnType<typeof listCommissions>>["data"] = [];
      let page = 1;
      let total = 0;

      do {
        const result = await listCommissions({
          ...filters,
          radiologyCenterId,
          page,
          limit: 100
        });
        rows.push(...result.data);
        total = result.total;
        page += 1;
      } while (rows.length < total);

      return rows;
    })
  );

  const page = Math.max(1, Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1);
  const limit = Math.max(1, Math.min(Number.isInteger(filters.limit) && filters.limit! > 0 ? filters.limit! : 20, 100));
  const data = perCenter
    .flat()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const skip = (page - 1) * limit;

  return {
    data: data.slice(skip, skip + limit),
    total: data.length,
    page,
    limit
  };
}

function sendCommissionServiceError(reply: any, error: unknown) {
  const message = (error as { message?: string }).message;

  if (message === "COMMISSION_ALREADY_EXISTS") {
    return reply.code(409).send({ error: "Ya existe una comisión para este examen" });
  }

  if (
    message === "COMMISSION_CONCURRENT_UPDATE" ||
    message === "COMMISSION_CANNOT_BE_APPROVED" ||
    message === "COMMISSION_CANNOT_BE_CANCELLED"
  ) {
    return reply.code(409).send({ error: "La comisión no puede modificarse en su estado actual" });
  }

  if (message === "ORDER_EXAM_NOT_FOUND") {
    return reply.code(404).send({ error: "Examen de orden no encontrado" });
  }

  if (message === "ORDER_EXAM_NOT_COMPLETED" || message === "COMMISSION_NOT_ELIGIBLE") {
    return reply.code(400).send({ error: "La comisión no es elegible" });
  }

  return null;
}

async function getCommissionForOperation(
  id: string,
  userId: string,
  userRole: string
) {
  const commission = await getCommissionById(id);

  if (!commission) {
    return { commission: null, allowed: false };
  }

  if (userRole === "ADMIN") {
    return { commission, allowed: true };
  }

  if (userRole !== "RADIOLOGY_CENTER_ADMIN" && userRole !== "RADIOLOGY_CENTER_STAFF") {
    return { commission, allowed: false };
  }

  const orderExam = await prisma.orderExam.findFirst({
    where: { id: commission.orderExamId },
    select: {
      order: {
        select: { radiologyCenterId: true }
      }
    }
  });

  if (!orderExam) {
    return { commission, allowed: false };
  }

  const userCenters = await prisma.userRadiologyCenter.findMany({
    where: {
      userId,
      isActive: true
    },
    select: { radiologyCenterId: true }
  });

  return {
    commission,
    allowed: userCenters.some(
      (userCenter) => userCenter.radiologyCenterId === orderExam.order.radiologyCenterId
    )
  };
}

export async function registerCommissionRoutes(app: FastifyInstance) {
  app.get(
    "/commissions",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request) => {
      const query = request.query as {
        dentistId?: string;
        radiologyCenterId?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: string;
        limit?: string;
      };

      const filters: ListCommissionsFilters = {
        dentistId: query.dentistId,
        radiologyCenterId: query.radiologyCenterId,
        status: query.status as any,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined
      };

      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      if (user.role === "DENTIST") {
        const dentist = await prisma.dentist.findFirst({
          where: { userId: user.sub },
          select: { id: true }
        });

        if (!dentist) {
          return { data: [], total: 0, page: 1, limit: 20 };
        }

        filters.dentistId = dentist.id;
      }

      if (user.role === "RADIOLOGY_CENTER_ADMIN" || user.role === "RADIOLOGY_CENTER_STAFF") {
        const centerIds = await getAuthorizedCenterIds(user.sub);

        if (centerIds.length === 0) {
          return { data: [], total: 0, page: 1, limit: 20 };
        }

        return listForAuthorizedCenters(filters, centerIds);
      }

      return listCommissions(filters);
    }
  );

  app.get(
    "/commissions/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const commission = await getCommissionById(id);

      if (!commission) {
        return reply.code(404).send({
          error: "Comisión no encontrada"
        });
      }

      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      if (user.role === "DENTIST") {
        const dentist = await prisma.dentist.findFirst({
          where: { userId: user.sub },
          select: { id: true }
        });

        if (!dentist) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.orderExam.findFirst({
          where: {
            id: commission.orderExamId,
            order: { dentistId: dentist.id }
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      if (user.role === "RADIOLOGY_CENTER_ADMIN" || user.role === "RADIOLOGY_CENTER_STAFF") {
        const userCenter = await prisma.userRadiologyCenter.findFirst({
          where: { userId: user.sub },
          select: { radiologyCenterId: true }
        });

        if (!userCenter) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.orderExam.findFirst({
          where: {
            id: commission.orderExamId,
            order: {
              radiologyCenterId: userCenter.radiologyCenterId
            }
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      return commission;
    }
  );

  app.get(
    "/commissions/order-exam/:orderExamId",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const orderExamId = (request.params as { orderExamId: string }).orderExamId;
      const commission = await getCommissionByOrderExamId(orderExamId);

      if (!commission) {
        return reply.code(404).send({
          error: "Comisión no encontrada"
        });
      }

      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      if (user.role === "DENTIST") {
        const dentist = await prisma.dentist.findFirst({
          where: { userId: user.sub },
          select: { id: true }
        });

        if (!dentist) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.orderExam.findFirst({
          where: {
            id: orderExamId,
            order: { dentistId: dentist.id }
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      if (user.role === "RADIOLOGY_CENTER_ADMIN" || user.role === "RADIOLOGY_CENTER_STAFF") {
        const userCenter = await prisma.userRadiologyCenter.findFirst({
          where: { userId: user.sub },
          select: { radiologyCenterId: true }
        });

        if (!userCenter) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.orderExam.findFirst({
          where: {
            id: orderExamId,
            order: {
              radiologyCenterId: userCenter.radiologyCenterId
            }
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      return commission;
    }
  );

  app.post(
    "/commissions/generate/:orderExamId",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const orderExamId = (request.params as { orderExamId: string }).orderExamId;
      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      if (user.role === "RADIOLOGY_CENTER_ADMIN" || user.role === "RADIOLOGY_CENTER_STAFF") {
        const userCenter = await prisma.userRadiologyCenter.findFirst({
          where: { userId: user.sub },
          select: { radiologyCenterId: true }
        });

        if (!userCenter) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.orderExam.findFirst({
          where: {
            id: orderExamId,
            order: {
              radiologyCenterId: userCenter.radiologyCenterId
            }
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      try {
        const commission = await generateCommissionFromOrderExam(orderExamId);
        return reply.code(201).send(commission);
      } catch (error: unknown) {
        const response = sendCommissionServiceError(reply, error);
        if (response) return response;
        throw error;
      }
    }
  );

  app.post(
    "/commissions/generate-for-order/:orderId",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const orderId = (request.params as { orderId: string }).orderId;
      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      if (user.role === "RADIOLOGY_CENTER_ADMIN" || user.role === "RADIOLOGY_CENTER_STAFF") {
        const userCenter = await prisma.userRadiologyCenter.findFirst({
          where: { userId: user.sub },
          select: { radiologyCenterId: true }
        });

        if (!userCenter) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }

        const hasAccess = await prisma.order.findFirst({
          where: {
            id: orderId,
            radiologyCenterId: userCenter.radiologyCenterId
          }
        });

        if (!hasAccess) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      const results = await generateCommissionsForOrder(orderId);

      return reply.code(200).send(results);
    }
  );

  app.patch(
    "/commissions/:id/approve",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        notes?: string | null;
      };
      const user = request.user as {
        sub: string;
        role: string;
      };
      const access = await getCommissionForOperation(id, user.sub, user.role);

      if (!access.commission) {
        return reply.code(404).send({
          error: "Comisión no encontrada"
        });
      }

      if (!access.allowed) {
        return reply.code(403).send({
          error: "Acceso prohibido"
        });
      }

      const approveInput: ApproveCommissionInput = {
        approvedBy: user.sub,
        notes: body.notes ?? null
      };

      try {
        const commission = await approveCommission(id, approveInput);

        if (!commission) {
          return reply.code(404).send({
            error: "Comisión no encontrada"
          });
        }

        return commission;
      } catch (error: unknown) {
        const response = sendCommissionServiceError(reply, error);
        if (response) return response;
        throw error;
      }
    }
  );

  app.patch(
    "/commissions/:id/cancel",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        cancellationReason?: string;
      };
      const user = request.user as {
        sub: string;
        role: string;
      };
      const access = await getCommissionForOperation(id, user.sub, user.role);

      if (!access.commission) {
        return reply.code(404).send({
          error: "Comisión no encontrada"
        });
      }

      if (!access.allowed) {
        return reply.code(403).send({
          error: "Acceso prohibido"
        });
      }

      if (!body.cancellationReason || body.cancellationReason.trim() === "") {
        return reply.code(400).send({
          error: "cancellationReason es obligatorio"
        });
      }

      const cancelInput: CancelCommissionInput = {
        cancelledBy: user.sub,
        cancellationReason: body.cancellationReason
      };

      try {
        const commission = await cancelCommission(id, cancelInput);

        if (!commission) {
          return reply.code(404).send({
            error: "Comisión no encontrada"
          });
        }

        return commission;
      } catch (error: unknown) {
        const response = sendCommissionServiceError(reply, error);
        if (response) return response;
        throw error;
      }
    }
  );
}
