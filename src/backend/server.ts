import Fastify from "fastify";

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

const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
