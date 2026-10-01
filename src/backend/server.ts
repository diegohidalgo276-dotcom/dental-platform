import Fastify from "fastify";
import prisma from "./prisma/client";
import { createUser } from "./services/user-service";

const app = Fastify({
  logger: true
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

app.get("/users", async () => {
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
});

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
