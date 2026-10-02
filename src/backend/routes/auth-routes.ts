import { FastifyInstance } from "fastify";
import { authenticateUser } from "../services/auth-service";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return reply.code(400).send({
        error: "email y password son obligatorios"
      });
    }

    const user = await authenticateUser(body.email, body.password);

    if (!user) {
      return reply.code(401).send({
        error: "Credenciales inválidas"
      });
    }

    const token = await app.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    return reply.send({
      token,
      user
    });
  });
};

