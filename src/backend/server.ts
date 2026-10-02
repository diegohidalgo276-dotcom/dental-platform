import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import prisma from "./prisma/client";
import { createUser } from "./services/user-service";
import { authenticateUser } from "./services/auth-service";
import { authenticate } from "./middlewares/auth";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET no está definida");
}

const app = Fastify({
  logger: true
});

app.register(fastifyJwt, {
  secret: jwtSecret
});

app.get("/", async () => {
  return {
    name: "Dental Platform API",
    status: "running",
    version: "0.1.0"
  };
});

app.get("/health/db", async () => {
  await prisma.$queryRaw`SELECT 1`;

  return {
    database: "postgresql",
    status: "connected"
  };
});

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

app.post("/users", async (request, reply) => {
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
});

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

const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
