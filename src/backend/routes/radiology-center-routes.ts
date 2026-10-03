import { FastifyInstance } from "fastify";
import { listRadiologyCenters, getRadiologyCenterById, createRadiologyCenter, updateRadiologyCenter, deleteRadiologyCenter } from "../services/radiology-center-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

export async function registerRadiologyCenterRoutes(app: FastifyInstance) {
  app.get(
    "/radiology-centers",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async () => {
      return listRadiologyCenters();
    }
  );

  app.get(
    "/radiology-centers/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const center = await getRadiologyCenterById(id);

      if (!center) {
        return reply.code(404).send({
          error: "Centro radiológico no encontrado"
        });
      }

      return center;
    }
  );

  app.post(
    "/radiology-centers",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        taxId?: string;
        address?: string;
        phone?: string;
        email?: string;
      };

      if (!body.name || !body.taxId) {
        return reply.code(400).send({
          error: "name y taxId son obligatorios"
        });
      }

      const center = await createRadiologyCenter({
        name: body.name,
        taxId: body.taxId,
        address: body.address,
        phone: body.phone,
        email: body.email
      });

      return reply.code(201).send(center);
    }
  );

  app.put(
    "/radiology-centers/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        name?: string;
        taxId?: string;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
        isActive?: boolean;
      };

      const center = await updateRadiologyCenter(id, {
        name: body.name,
        taxId: body.taxId,
        address: body.address,
        phone: body.phone,
        email: body.email,
        isActive: body.isActive
      });

      if (!center) {
        return reply.code(404).send({
          error: "Centro radiológico no encontrado"
        });
      }

      return reply.code(200).send(center);
    }
  );

  app.delete(
    "/radiology-centers/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const center = await deleteRadiologyCenter(id);

      if (!center) {
        return reply.code(404).send({
          error: "Centro radiológico no encontrado"
        });
      }

      return reply.code(200).send(center);
    }
  );
}
