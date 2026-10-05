import { FastifyInstance } from "fastify";
import { listExamPrices, getExamPriceById, createExamPrice, updateExamPrice, deleteExamPrice } from "../services/exam-price-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";
import prisma from "../prisma/client";

export async function registerExamPriceRoutes(app: FastifyInstance) {
  app.get(
    "/exam-prices",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async () => {
      return listExamPrices();
    }
  );

  app.get(
    "/exam-prices/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const examPrice = await getExamPriceById(id);

      if (!examPrice) {
        return reply.code(404).send({
          error: "Precio de examen no encontrado"
        });
      }

      return examPrice;
    }
  );

  app.post(
    "/exam-prices",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        examId?: string;
        radiologyCenterId?: string;
        price?: number;
        validFrom?: string;
        validTo?: string;
      };

      if (!body.examId) {
        return reply.code(400).send({
          error: "examId es obligatorio"
        });
      }

      if (!body.radiologyCenterId) {
        return reply.code(400).send({
          error: "radiologyCenterId es obligatorio"
        });
      }

      if (body.price === undefined || body.price === null) {
        return reply.code(400).send({
          error: "price es obligatorio"
        });
      }

       if (typeof body.price !== "number" || body.price < 0) {
          return reply.code(400).send({
            error: "price debe ser un número mayor o igual a 0"
          });
        }

      if (!body.validFrom) {
        return reply.code(400).send({
          error: "validFrom es obligatorio"
        });
      }

       const validFrom = new Date(body.validFrom);
       if (isNaN(validFrom.getTime())) {
         return reply.code(400).send({
           error: "validFrom no es una fecha válida"
         });
       }

      let validTo: Date | null = null;
      if (body.validTo) {
         validTo = new Date(body.validTo);
         if (isNaN(validTo.getTime())) {
           return reply.code(400).send({
             error: "validTo no es una fecha válida"
           });
         }

        if (validTo < validFrom) {
          return reply.code(400).send({
            error: "validTo no puede ser anterior a validFrom"
          });
        }
      }

      const exam = await prisma.exam.findFirst({
        where: {
          id: body.examId,
          deletedAt: null
        }
      });

      if (!exam) {
        return reply.code(404).send({
          error: "Examen no encontrado"
        });
      }

      const radiologyCenter = await prisma.radiologyCenter.findFirst({
        where: {
          id: body.radiologyCenterId,
          deletedAt: null
        }
      });

       if (!radiologyCenter) {
         return reply.code(404).send({
           error: "Centro radiológico no encontrado"
         });
       }

      try {
        const examPrice = await createExamPrice({
          examId: body.examId,
          radiologyCenterId: body.radiologyCenterId,
          price: body.price,
          validFrom: validFrom,
          validTo: validTo
        });

        return reply.code(201).send(examPrice);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === "P2002") {
          return reply.code(409).send({
            error: "Ya existe un precio para este examen, centro y fecha de vigencia"
          });
        }
        throw error;
      }
    }
  );

  app.put(
    "/exam-prices/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        price?: number;
        validFrom?: string;
        validTo?: string | null;
        isActive?: boolean;
      };

      const existingExamPrice = await getExamPriceById(id);
      if (!existingExamPrice) {
        return reply.code(404).send({
          error: "Precio de examen no encontrado"
        });
      }

      if (body.price !== undefined) {
        if (typeof body.price !== "number" || body.price < 0) {
          return reply.code(400).send({
            error: "price debe ser un número mayor o igual a 0"
          });
        }
      }

      let validFrom: Date | undefined = undefined;
      if (body.validFrom) {
        validFrom = new Date(body.validFrom);
        if (isNaN(validFrom.getTime())) {
          return reply.code(400).send({
            error: "validFrom no es una fecha válida"
          });
        }
      }

      let validTo: Date | null | undefined = undefined;
      if (body.validTo !== undefined) {
        if (body.validTo === null) {
          validTo = null;
        } else {
          validTo = new Date(body.validTo);
          if (isNaN(validTo.getTime())) {
            return reply.code(400).send({
              error: "validTo no es una fecha válida"
            });
          }
        }
      }

      const finalValidFrom = validFrom !== undefined ? validFrom : existingExamPrice.validFrom;
      const finalValidTo = validTo !== undefined ? validTo : existingExamPrice.validTo;

      if (finalValidTo !== null && finalValidTo < finalValidFrom) {
        return reply.code(400).send({
          error: "validTo no puede ser anterior a validFrom"
        });
      }

      try {
        const examPrice = await updateExamPrice(id, {
          price: body.price,
          validFrom: validFrom,
          validTo: validTo,
          isActive: body.isActive
        });

        if (!examPrice) {
          return reply.code(404).send({
            error: "Precio de examen no encontrado"
          });
        }

        return reply.code(200).send(examPrice);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === "P2002") {
          return reply.code(409).send({
            error: "Ya existe un precio para este examen, centro y fecha de vigencia"
          });
        }
        throw error;
      }
    }
  );

  app.delete(
    "/exam-prices/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const examPrice = await deleteExamPrice(id);

      if (!examPrice) {
        return reply.code(404).send({
          error: "Precio de examen no encontrado"
        });
      }

      return reply.code(200).send(examPrice);
    }
  );
}
