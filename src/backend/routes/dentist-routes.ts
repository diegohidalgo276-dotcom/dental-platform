import { FastifyInstance } from "fastify";
import { listDentists, getDentistById, createDentist, updateDentist, deleteDentist } from "../services/dentist-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

export async function registerDentistRoutes(app: FastifyInstance) {
  app.get(
    "/dentists",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async () => {
      return listDentists();
    }
  );

  app.get(
    "/dentists/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const dentist = await getDentistById(id);

      if (!dentist) {
        return reply.code(404).send({
          error: "Dentista no encontrado"
        });
      }

      return dentist;
    }
  );

  app.post(
    "/dentists",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        specialty?: string;
        licenseNumber?: string;
        taxId?: string;
        userId?: string;
      };

      if (!body.name || !body.email || !body.licenseNumber || !body.userId) {
        return reply.code(400).send({
          error: "name, email, licenseNumber y userId son obligatorios"
        });
      }

      const dentist = await createDentist({
        name: body.name,
        email: body.email,
        phone: body.phone,
        specialty: body.specialty,
        licenseNumber: body.licenseNumber,
        taxId: body.taxId,
        userId: body.userId
      });

      return reply.code(201).send(dentist);
    }
  );

  app.put(
    "/dentists/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string | null;
        specialty?: string | null;
        licenseNumber?: string;
        taxId?: string | null;
        isActive?: boolean;
      };

      const dentist = await updateDentist(id, {
        name: body.name,
        email: body.email,
        phone: body.phone,
        specialty: body.specialty,
        licenseNumber: body.licenseNumber,
        taxId: body.taxId,
        isActive: body.isActive
      });

      if (!dentist) {
        return reply.code(404).send({
          error: "Dentista no encontrado"
        });
      }

      return reply.code(200).send(dentist);
    }
  );

  app.delete(
    "/dentists/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const dentist = await deleteDentist(id);

      if (!dentist) {
        return reply.code(404).send({
          error: "Dentista no encontrado"
        });
      }

      return reply.code(200).send(dentist);
    }
  );
}