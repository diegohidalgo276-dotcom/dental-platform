import { FastifyInstance } from "fastify";
import {
  createExamResult,
  getExamResultById,
  getExamResultByOrderExamId,
  updateExamResult,
  listExamResults,
  type ExamResultStatus,
  type CreateExamResultInput,
  type UpdateExamResultInput,
  type ListExamResultsFilters,
} from "../services/exam-result-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";
import prisma from "../prisma/client";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidStatus(status: string): status is ExamResultStatus {
  return ["PENDING", "PROCESSING", "COMPLETED", "REVIEWED"].includes(status);
}

async function canAccessOrderExam(
  userId: string,
  userRole: string,
  orderExamId: string
): Promise<{ allowed: boolean; orderExam?: any; error?: string }> {
  const orderExam = await prisma.orderExam.findUnique({
    where: { id: orderExamId },
    select: {
      id: true,
      order: {
        select: {
          id: true,
          dentistId: true,
          radiologyCenterId: true,
        },
      },
    },
  });

  if (!orderExam) {
    return { allowed: false, error: "ORDER_EXAM_NOT_FOUND" };
  }

  if (userRole === "ADMIN") {
    return { allowed: true, orderExam };
  }

  if (userRole === "DENTIST") {
    const dentist = await prisma.dentist.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!dentist || dentist.id !== orderExam.order.dentistId) {
      return { allowed: false, error: "FORBIDDEN" };
    }

    return { allowed: true, orderExam };
  }

  if (userRole === "RADIOLOGY_CENTER_STAFF" || userRole === "RADIOLOGY_CENTER_ADMIN") {
    const userCenter = await prisma.userRadiologyCenter.findFirst({
      where: {
        userId,
        radiologyCenterId: orderExam.order.radiologyCenterId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!userCenter) {
      return { allowed: false, error: "FORBIDDEN" };
    }

    return { allowed: true, orderExam };
  }

  return { allowed: false, error: "FORBIDDEN" };
}

async function canAccessExamResult(
  userId: string,
  userRole: string,
  examResultId: string
): Promise<{ allowed: boolean; examResult?: any; error?: string }> {
  const examResult = await prisma.examResult.findUnique({
    where: { id: examResultId },
    select: {
      id: true,
      orderExamId: true,
      orderExam: {
        select: {
          id: true,
          order: {
            select: {
              id: true,
              dentistId: true,
              radiologyCenterId: true,
            },
          },
        },
      },
    },
  });

  if (!examResult) {
    return { allowed: false, error: "EXAM_RESULT_NOT_FOUND" };
  }

  return canAccessOrderExam(userId, userRole, examResult.orderExamId);
}

export async function registerExamResultRoutes(app: FastifyInstance) {
  app.post(
    "/exam-results",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])],
    },
    async (request, reply) => {
      const body = request.body as {
        orderExamId?: string;
        fileUrl?: string;
        fileType?: string | null;
        notes?: string | null;
        status?: string;
      };

      if (!body.orderExamId) {
        return reply.code(400).send({ error: "orderExamId es obligatorio" });
      }

      if (!body.fileUrl) {
        return reply.code(400).send({ error: "fileUrl es obligatorio" });
      }

      if (!isValidUrl(body.fileUrl)) {
        return reply.code(400).send({ error: "fileUrl no es una URL válida" });
      }

      if (body.fileType !== undefined && body.fileType !== null && typeof body.fileType !== "string") {
        return reply.code(400).send({ error: "fileType debe ser un string" });
      }

      if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
        return reply.code(400).send({ error: "notes debe ser un string" });
      }

      if (body.status !== undefined && !isValidStatus(body.status)) {
        return reply.code(400).send({ error: "status debe ser PENDING, PROCESSING, COMPLETED o REVIEWED" });
      }

      const user = request.user as { sub: string; email: string; role: string };

      const accessCheck = await canAccessOrderExam(user.sub, user.role, body.orderExamId);
      if (!accessCheck.allowed) {
        if (accessCheck.error === "ORDER_EXAM_NOT_FOUND") {
          return reply.code(404).send({ error: "OrderExam no encontrado" });
        }
        return reply.code(403).send({ error: "No tiene autorización para crear resultados en este OrderExam" });
      }

      try {
        const input: CreateExamResultInput = {
          orderExamId: body.orderExamId,
          fileUrl: body.fileUrl,
          fileType: body.fileType ?? null,
          notes: body.notes ?? null,
          status: body.status as ExamResultStatus | undefined,
        };

        const result = await createExamResult(input);
        return reply.code(201).send(result);
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === "ORDER_EXAM_NOT_FOUND") {
          return reply.code(404).send({ error: "OrderExam no encontrado" });
        }
        if (err.message === "EXAM_RESULT_ALREADY_EXISTS") {
          return reply.code(409).send({ error: "Ya existe un resultado para este OrderExam" });
        }
        throw error;
      }
    }
  );

  app.get(
    "/exam-results",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])],
    },
    async (request) => {
      const query = request.query as {
        orderExamId?: string;
        status?: string;
        page?: string;
        limit?: string;
      };

      const user = request.user as { sub: string; email: string; role: string };
      const filters: ListExamResultsFilters = {
        orderExamId: query.orderExamId,
        status: query.status as ExamResultStatus | undefined,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      };

      if (filters.orderExamId) {
        const accessCheck = await canAccessOrderExam(user.sub, user.role, filters.orderExamId);
        if (!accessCheck.allowed) {
          if (accessCheck.error === "ORDER_EXAM_NOT_FOUND") {
            return { data: [], total: 0, page: 1, limit: 20 };
          }
          return { data: [], total: 0, page: 1, limit: 20 };
        }
      
      } else if (user.role === "DENTIST") {
        const dentist = await prisma.dentist.findFirst({
          where: { userId: user.sub },
          select: { id: true },
        });

        filters.dentistId = dentist?.id ?? "";
      } else if (
        user.role === "RADIOLOGY_CENTER_STAFF" ||
        user.role === "RADIOLOGY_CENTER_ADMIN"
      ) {
        const userCenters = await prisma.userRadiologyCenter.findMany({
          where: { userId: user.sub, isActive: true },
          select: { radiologyCenterId: true },
        });

        filters.radiologyCenterIds = userCenters.map(
          (center) => center.radiologyCenterId
        );
      }

      return listExamResults(filters);

    }
  );

  app.get(
    "/exam-results/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])],
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const user = request.user as { sub: string; email: string; role: string };

      const accessCheck = await canAccessExamResult(user.sub, user.role, id);
      if (!accessCheck.allowed) {
        if (accessCheck.error === "EXAM_RESULT_NOT_FOUND") {
          return reply.code(404).send({ error: "Resultado no encontrado" });
        }
        return reply.code(403).send({ error: "No tiene autorización para ver este resultado" });
      }

      const result = await getExamResultById(id);
      return result;
    }
  );

  app.patch(
    "/exam-results/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "RADIOLOGY_CENTER_ADMIN", "RADIOLOGY_CENTER_STAFF"])],
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        fileUrl?: string | null;
        fileType?: string | null;
        notes?: string | null;
        status?: string;
      };

      const user = request.user as { sub: string; email: string; role: string };

      const accessCheck = await canAccessExamResult(user.sub, user.role, id);
      if (!accessCheck.allowed) {
        if (accessCheck.error === "EXAM_RESULT_NOT_FOUND") {
          return reply.code(404).send({ error: "Resultado no encontrado" });
        }
        return reply.code(403).send({ error: "No tiene autorización para actualizar este resultado" });
      }

      if (body.fileUrl !== undefined && body.fileUrl !== null && !isValidUrl(body.fileUrl)) {
        return reply.code(400).send({ error: "fileUrl no es una URL válida" });
      }

      if (body.fileType !== undefined && body.fileType !== null && typeof body.fileType !== "string") {
        return reply.code(400).send({ error: "fileType debe ser un string" });
      }

      if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
        return reply.code(400).send({ error: "notes debe ser un string" });
      }

      if (body.status !== undefined && !isValidStatus(body.status)) {
        return reply.code(400).send({ error: "status debe ser PENDING, PROCESSING, COMPLETED o REVIEWED" });
      }

      const input: UpdateExamResultInput = {
        fileUrl: body.fileUrl,
        fileType: body.fileType,
        notes: body.notes,
        status: body.status as ExamResultStatus | undefined,
      };

      const result = await updateExamResult(id, input);

      if (!result) {
        return reply.code(404).send({ error: "Resultado no encontrado" });
      }

      return reply.code(200).send(result);
    }
  );
}