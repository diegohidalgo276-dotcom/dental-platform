import { FastifyInstance } from "fastify";
import { listExams, getExamById, createExam, updateExam, deleteExam } from "../services/exam-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

export async function registerExamRoutes(app: FastifyInstance) {
  app.get(
    "/exams",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async () => {
      return listExams();
    }
  );

  app.get(
    "/exams/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const exam = await getExamById(id);

      if (!exam) {
        return reply.code(404).send({
          error: "Examen no encontrado"
        });
      }

      return exam;
    }
  );

  app.post(
    "/exams",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        description?: string;
        code?: string;
      };

      if (!body.name) {
        return reply.code(400).send({
          error: "name es obligatorio"
        });
      }

      const exam = await createExam({
        name: body.name,
        description: body.description,
        code: body.code
      });

      return reply.code(201).send(exam);
    }
  );

  app.put(
    "/exams/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        name?: string;
        description?: string | null;
        code?: string | null;
        isActive?: boolean;
      };

      const exam = await updateExam(id, {
        name: body.name,
        description: body.description,
        code: body.code,
        isActive: body.isActive
      });

      if (!exam) {
        return reply.code(404).send({
          error: "Examen no encontrado"
        });
      }

      return reply.code(200).send(exam);
    }
  );

  app.delete(
    "/exams/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const exam = await deleteExam(id);

      if (!exam) {
        return reply.code(404).send({
          error: "Examen no encontrado"
        });
      }

      return reply.code(200).send(exam);
    }
  );
}
