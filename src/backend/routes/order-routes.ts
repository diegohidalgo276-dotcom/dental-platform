import { FastifyInstance } from "fastify";
import { createOrder, getOrderById, listOrders } from "../services/order-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";
import prisma from "../prisma/client";

export async function registerOrderRoutes(app: FastifyInstance) {
  app.get(
    "/orders",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request) => {
      const query = request.query as {
        status?: string;
        dentistId?: string;
        radiologyCenterId?: string;
        patientId?: string;
        page?: string;
        limit?: string;
      };

      const filters = {
        status: query.status as any,
        dentistId: query.dentistId,
        radiologyCenterId: query.radiologyCenterId,
        patientId: query.patientId,
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

        if (dentist) {
          filters.dentistId = dentist.id;
        }
      }

      return listOrders(filters);
    }
  );

  app.get(
    "/orders/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST", "RADIOLOGY_CENTER_STAFF"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const order = await getOrderById(id);

      if (!order) {
        return reply.code(404).send({
          error: "Orden no encontrada"
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

        if (!dentist || dentist.id !== order.dentistId) {
          return reply.code(403).send({
            error: "Acceso prohibido"
          });
        }
      }

      return order;
    }
  );

  app.post(
    "/orders",
    {
      preHandler: [authenticate, requireRoles(["ADMIN", "DENTIST"])]
    },
    async (request, reply) => {
      const body = request.body as {
        patientId?: string;
        dentistId?: string;
        radiologyCenterId?: string;
        notes?: string;
        orderExams?: Array<{
          examId: string;
          quantity: number;
          discount?: number;
        }>;
      };

      if (!body.patientId) {
        return reply.code(400).send({
          error: "patientId es obligatorio"
        });
      }

      if (!body.radiologyCenterId) {
        return reply.code(400).send({
          error: "radiologyCenterId es obligatorio"
        });
      }

      if (!body.orderExams || body.orderExams.length === 0) {
        return reply.code(400).send({
          error: "orderExams no puede estar vacío"
        });
      }

      const user = request.user as {
        sub: string;
        email: string;
        role: string;
      };

      let dentistId = body.dentistId;

      if (user.role === "DENTIST") {
        const dentist = await prisma.dentist.findFirst({
          where: { userId: user.sub },
          select: { id: true }
        });

        if (!dentist) {
          return reply.code(403).send({
            error: "Usuario dentista no vinculado a un perfil de dentista"
          });
        }

        dentistId = dentist.id;

        const dentistCenter = await prisma.dentistCenter.findFirst({
          where: {
            dentistId: dentist.id,
            radiologyCenterId: body.radiologyCenterId,
            isActive: true
          }
        });

        if (!dentistCenter) {
          return reply.code(403).send({
            error: "No tiene autorización para crear órdenes en este centro radiológico"
          });
        }
      } else if (user.role === "ADMIN") {
        if (!body.dentistId) {
          return reply.code(400).send({
            error: "dentistId es obligatorio para ADMIN"
          });
        }

        const dentistExists = await prisma.dentist.findFirst({
          where: { id: body.dentistId },
          select: { id: true }
        });

        if (!dentistExists) {
          return reply.code(404).send({
            error: "Dentista no encontrado"
          });
        }

        dentistId = body.dentistId;
      }

      const patientExists = await prisma.patient.findFirst({
        where: { id: body.patientId, deletedAt: null },
        select: { id: true }
      });

      if (!patientExists) {
        return reply.code(404).send({
          error: "Paciente no encontrado"
        });
      }

      const centerExists = await prisma.radiologyCenter.findFirst({
        where: { id: body.radiologyCenterId, deletedAt: null },
        select: { id: true }
      });

      if (!centerExists) {
        return reply.code(404).send({
          error: "Centro radiológico no encontrado"
        });
      }

      for (const exam of body.orderExams) {
        if (!exam.examId || typeof exam.quantity !== "number" || exam.quantity < 1) {
          return reply.code(400).send({
            error: "Cada examen debe tener examId y quantity >= 1"
          });
        }

        const examExists = await prisma.exam.findFirst({
          where: { id: exam.examId, deletedAt: null },
          select: { id: true }
        });

        if (!examExists) {
          return reply.code(404).send({
            error: `Examen ${exam.examId} no encontrado`
          });
        }

        if (exam.discount && exam.discount < 0) {
          return reply.code(400).send({
            error: "El descuento no puede ser negativo"
          });
        }
      }

      try {
        const order = await createOrder({
          patientId: body.patientId,
          dentistId: dentistId!,
          radiologyCenterId: body.radiologyCenterId,
          notes: body.notes,
          orderExams: body.orderExams
        });

        return reply.code(201).send(order);
      } catch (error: unknown) {
        const err = error as { message?: string };

        if (err.message?.startsWith("NO_EXAM_PRICE:")) {
          const examId = err.message.split(":")[1];
          return reply.code(400).send({
            error: `No existe precio vigente para el examen ${examId} en este centro radiológico`
          });
        }

        throw error;
      }
    }
  );
}
