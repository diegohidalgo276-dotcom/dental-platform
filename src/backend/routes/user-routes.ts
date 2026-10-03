import { FastifyInstance } from "fastify";
import prisma from "../prisma/client";
import { createUser } from "../services/user-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";

export async function registerUserRoutes(app: FastifyInstance) {
  app.get(
    "/users",
    {
      preHandler: authenticate
    },
    async () => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return users;
    }
  );

  app.post(
    "/users",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        email?: string;
        name?: string;
        password?: string;
        role?: "ADMIN" | "RADIOLOGY_CENTER_ADMIN" | "RADIOLOGY_CENTER_STAFF" | "DENTIST";
      };

      if (!body.email || !body.name || !body.password || !body.role) {
        return reply.code(400).send({
          error: "email, name, password y role son obligatorios"
        });
      }

      const user = await createUser({
        email: body.email,
        name: body.name,
        password: body.password,
        role: body.role
      });

      return reply.code(201).send(user);
    }
  );
}