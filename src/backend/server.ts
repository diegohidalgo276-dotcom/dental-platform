import Fastify from "fastify";
import prisma from "./prisma/client";

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
