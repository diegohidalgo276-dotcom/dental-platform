import { FastifyInstance } from "fastify";
import { listPatients, getPatientById, createPatient, updatePatient, deletePatient } from "../services/patient-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

export async function registerPatientRoutes(app: FastifyInstance) {
  app.get(
    "/patients",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async () => {
      return listPatients();
    }
  );

  app.get(
    "/patients/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const patient = await getPatientById(id);

      if (!patient) {
        return reply.code(404).send({
          error: "Paciente no encontrado"
        });
      }

      return patient;
    }
  );

  app.post(
    "/patients",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        document?: string;
        birthDate?: string;
      };

      if (!body.name) {
        return reply.code(400).send({
          error: "name es obligatorio"
        });
      }

      let birthDate: Date | undefined = undefined;
      if (body.birthDate) {
        birthDate = new Date(body.birthDate);
        if (isNaN(birthDate.getTime())) {
          return reply.code(400).send({
            error: "birthDate no es válida"
          });
        }
      }

      const patient = await createPatient({
        name: body.name,
        email: body.email,
        phone: body.phone,
        document: body.document,
        birthDate: birthDate
      });

      return reply.code(201).send(patient);
    }
  );

  app.put(
    "/patients/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        name?: string;
        email?: string | null;
        phone?: string | null;
        document?: string | null;
        birthDate?: string | null;
        isActive?: boolean;
      };

      let birthDate: Date | null | undefined = undefined;
      if (body.birthDate !== undefined) {
        if (body.birthDate === null) {
          birthDate = null;
        } else {
          birthDate = new Date(body.birthDate);
          if (isNaN(birthDate.getTime())) {
            return reply.code(400).send({
              error: "birthDate no es válida"
            });
          }
        }
      }

      const patient = await updatePatient(id, {
        name: body.name,
        email: body.email,
        phone: body.phone,
        document: body.document,
        birthDate: birthDate,
        isActive: body.isActive
      });

      if (!patient) {
        return reply.code(404).send({
          error: "Paciente no encontrado"
        });
      }

      return reply.code(200).send(patient);
    }
  );

  app.delete(
    "/patients/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const patient = await deletePatient(id);

      if (!patient) {
        return reply.code(404).send({
          error: "Paciente no encontrado"
        });
      }

      return reply.code(200).send(patient);
    }
  );
}