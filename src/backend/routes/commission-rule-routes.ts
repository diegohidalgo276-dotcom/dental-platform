import { FastifyInstance } from "fastify";
import {
  listCommissionRules,
  getCommissionRuleById,
  createCommissionRuleInTx,
  updateCommissionRuleInTx,
  deleteCommissionRule
} from "../services/commission-rule-service";
import { authenticate } from "../middlewares/auth";
import { requireRoles } from "../middlewares/role-guard";
import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

export async function registerCommissionRuleRoutes(app: FastifyInstance) {
  app.get(
    "/commission-rules",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request) => {
      const query = request.query as {
        radiologyCenterId?: string;
        examId?: string;
        dentistId?: string;
        isActive?: string;
        page?: string;
        limit?: string;
      };

      const filters = {
        radiologyCenterId: query.radiologyCenterId,
        examId: query.examId,
        dentistId: query.dentistId,
        isActive: query.isActive === "true" ? true : query.isActive === "false" ? false : undefined,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined
      };

      return listCommissionRules(filters);
    }
  );

  app.get(
    "/commission-rules/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const commissionRule = await getCommissionRuleById(id);

      if (!commissionRule) {
        return reply.code(404).send({
          error: "Regla de comisión no encontrada"
        });
      }

      return commissionRule;
    }
  );

  app.post(
    "/commission-rules",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const body = request.body as {
        commissionType?: string;
        percentage?: number | null;
        fixedAmount?: number | null;
        validFrom?: string;
        validTo?: string | null;
        priority?: number;
        radiologyCenterId?: string;
        examId?: string;
        dentistId?: string | null;
      };

      if (!body.radiologyCenterId) {
        return reply.code(400).send({
          error: "radiologyCenterId es obligatorio"
        });
      }

      if (!body.examId) {
        return reply.code(400).send({
          error: "examId es obligatorio"
        });
      }

      if (!body.commissionType) {
        return reply.code(400).send({
          error: "commissionType es obligatorio"
        });
      }

      if (!["PERCENTAGE", "FIXED", "NONE"].includes(body.commissionType)) {
        return reply.code(400).send({
          error: "commissionType debe ser PERCENTAGE, FIXED o NONE"
        });
      }

      if (body.commissionType === "PERCENTAGE") {
        if (body.percentage === undefined || body.percentage === null) {
          return reply.code(400).send({
            error: "percentage es obligatorio para tipo PERCENTAGE"
          });
        }
        if (typeof body.percentage !== "number" || body.percentage <= 0 || body.percentage > 100) {
          return reply.code(400).send({
            error: "percentage debe ser mayor que 0 y menor o igual que 100"
          });
        }
        if (body.fixedAmount !== null && body.fixedAmount !== undefined) {
          return reply.code(400).send({
            error: "fixedAmount debe ser nulo para tipo PERCENTAGE"
          });
        }
      }

      if (body.commissionType === "FIXED") {
        if (body.fixedAmount === undefined || body.fixedAmount === null) {
          return reply.code(400).send({
            error: "fixedAmount es obligatorio para tipo FIXED"
          });
        }
        if (typeof body.fixedAmount !== "number" || body.fixedAmount < 0) {
          return reply.code(400).send({
            error: "fixedAmount debe ser mayor o igual que 0"
          });
        }
        if (body.percentage !== null && body.percentage !== undefined) {
          return reply.code(400).send({
            error: "percentage debe ser nulo para tipo FIXED"
          });
        }
      }

      if (body.commissionType === "NONE") {
        if (body.percentage !== null && body.percentage !== undefined) {
          return reply.code(400).send({
            error: "percentage debe ser nulo para tipo NONE"
          });
        }
        if (body.fixedAmount !== null && body.fixedAmount !== undefined) {
          return reply.code(400).send({
            error: "fixedAmount debe ser nulo para tipo NONE"
          });
        }
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

      if (body.priority === undefined || body.priority === null) {
        return reply.code(400).send({
          error: "priority es obligatorio"
        });
      }

      if (typeof body.priority !== "number" || !Number.isInteger(body.priority)) {
        return reply.code(400).send({
          error: "priority debe ser un entero válido"
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

      if (body.dentistId) {
        const dentist = await prisma.dentist.findFirst({
          where: {
            id: body.dentistId,
            deletedAt: null
          }
        });

        if (!dentist) {
          return reply.code(404).send({
            error: "Dentista no encontrado"
          });
        }
      }

      try {
        const commissionRule = await prisma.$transaction(
          async (tx) => {
            const dentistIdValue = body.dentistId || null;

            const overlappingRules = await tx.commissionRule.findMany({
              where: {
                radiologyCenterId: body.radiologyCenterId,
                examId: body.examId,
                dentistId: dentistIdValue,
                isActive: true,
                OR: [
                  {
                    AND: [
                      { validFrom: { lte: validFrom } },
                      {
                        OR: [
                          { validTo: null },
                          { validTo: { gte: validFrom } }
                        ]
                      }
                    ]
                  },
                  {
                    AND: [
                      { validFrom: { lte: validTo || new Date("9999-12-31") } },
                      {
                        OR: [
                          { validTo: null },
                          { validTo: { gte: validTo || new Date("9999-12-31") } }
                        ]
                      }
                    ]
                  },
                  {
                    AND: [
                      { validFrom: { gte: validFrom } },
                      validTo !== null
                        ? { validFrom: { lte: validTo } }
                        : {}
                    ]
                  }
                ]
              }
            });

            if (overlappingRules.length > 0) {
              throw new Error("OVERLAPPING_RULE");
            }

            return createCommissionRuleInTx(
              {
                commissionType: body.commissionType as "PERCENTAGE" | "FIXED" | "NONE",
                percentage: body.percentage ?? null,
                fixedAmount: body.fixedAmount ?? null,
                validFrom,
                validTo,
                priority: body.priority!,
                radiologyCenterId: body.radiologyCenterId!,
                examId: body.examId!,
                dentistId: body.dentistId ?? null
              },
              tx
            );
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );

        return reply.code(201).send(commissionRule);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.message === "OVERLAPPING_RULE") {
          return reply.code(409).send({
            error: "Ya existe una regla activa con periodos de vigencia superpuestos para el mismo alcance"
          });
        }
        if (err.code === "P2002") {
          return reply.code(409).send({
            error: "Ya existe una regla con la misma configuracion"
          });
        }
        if (err.code === "P2034") {
          return reply.code(409).send({
            error: "Conflicto de concurrencia, intente nuevamente"
          });
        }
        throw error;
      }
    }
  );

  app.put(
    "/commission-rules/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const body = request.body as {
        commissionType?: string;
        percentage?: number | null;
        fixedAmount?: number | null;
        validFrom?: string;
        validTo?: string | null;
        isActive?: boolean;
        priority?: number;
      };

      const existingRule = await getCommissionRuleById(id);
      if (!existingRule) {
        return reply.code(404).send({
          error: "Regla de comision no encontrada"
        });
      }

      const existingCommissionType = existingRule.commissionType as "PERCENTAGE" | "FIXED" | "NONE";
      const newCommissionType = body.commissionType as "PERCENTAGE" | "FIXED" | "NONE" | undefined;
      const finalCommissionType = newCommissionType || existingCommissionType;

      let percentageValue: number | null = null;
      let fixedAmountValue: number | null = null;

      if (newCommissionType === "PERCENTAGE" || finalCommissionType === "PERCENTAGE") {
        if (body.percentage !== undefined) {
          percentageValue = body.percentage;
        } else if (existingCommissionType === "PERCENTAGE") {
          percentageValue = existingRule.percentage ? Number(existingRule.percentage) : null;
        } else {
          percentageValue = null;
        }

        if (percentageValue === null || percentageValue === undefined) {
          return reply.code(400).send({
            error: "percentage es obligatorio para tipo PERCENTAGE"
          });
        }

        if (typeof percentageValue !== "number" || percentageValue <= 0 || percentageValue > 100) {
          return reply.code(400).send({
            error: "percentage debe ser mayor que 0 y menor o igual que 100"
          });
        }

        if (body.fixedAmount !== undefined) {
          if (body.fixedAmount !== null) {
            return reply.code(400).send({
              error: "fixedAmount debe ser nulo para tipo PERCENTAGE"
            });
          }
          fixedAmountValue = null;
        } else if (newCommissionType === "PERCENTAGE" || finalCommissionType !== existingCommissionType) {
          fixedAmountValue = null;
        } else {
          fixedAmountValue = existingRule.fixedAmount ? Number(existingRule.fixedAmount) : null;
        }
      } else if (newCommissionType === "FIXED" || finalCommissionType === "FIXED") {
        if (body.fixedAmount !== undefined) {
          fixedAmountValue = body.fixedAmount;
        } else if (existingCommissionType === "FIXED") {
          fixedAmountValue = existingRule.fixedAmount ? Number(existingRule.fixedAmount) : null;
        } else {
          fixedAmountValue = null;
        }

        if (fixedAmountValue === null || fixedAmountValue === undefined) {
          return reply.code(400).send({
            error: "fixedAmount es obligatorio para tipo FIXED"
          });
        }

        if (typeof fixedAmountValue !== "number" || fixedAmountValue < 0) {
          return reply.code(400).send({
            error: "fixedAmount debe ser mayor o igual que 0"
          });
        }

        if (body.percentage !== undefined) {
          if (body.percentage !== null) {
            return reply.code(400).send({
              error: "percentage debe ser nulo para tipo FIXED"
            });
          }
          percentageValue = null;
        } else if (newCommissionType === "FIXED" || finalCommissionType !== existingCommissionType) {
          percentageValue = null;
        } else {
          percentageValue = existingRule.percentage ? Number(existingRule.percentage) : null;
        }
      } else if (newCommissionType === "NONE" || finalCommissionType === "NONE") {
        if (body.percentage !== undefined && body.percentage !== null) {
          return reply.code(400).send({
            error: "percentage debe ser nulo para tipo NONE"
          });
        }
        if (body.fixedAmount !== undefined && body.fixedAmount !== null) {
          return reply.code(400).send({
            error: "fixedAmount debe ser nulo para tipo NONE"
          });
        }

        if (body.percentage === undefined) {
          percentageValue = null;
        }
        if (body.fixedAmount === undefined) {
          fixedAmountValue = null;
        }
      }

      if (newCommissionType && !["PERCENTAGE", "FIXED", "NONE"].includes(newCommissionType)) {
        return reply.code(400).send({
          error: "commissionType debe ser PERCENTAGE, FIXED o NONE"
        });
      }

      if (newCommissionType === undefined && finalCommissionType !== existingCommissionType) {
        return reply.code(400).send({
          error: "El tipo de comision no puede cambiarse sin enviar commissionType"
        });
      }

      let validFrom: Date | undefined = undefined;
      if (body.validFrom) {
        validFrom = new Date(body.validFrom);
        if (isNaN(validFrom.getTime())) {
          return reply.code(400).send({
            error: "validFrom no es una fecha valida"
          });
        }
      }

      let validTo: Date | null | undefined = undefined;
      if (body.validTo !== undefined) {
        if (body.validTo === null) {
          validTo = null;
        } else if (body.validTo) {
          validTo = new Date(body.validTo);
          if (isNaN(validTo.getTime())) {
            return reply.code(400).send({
              error: "validTo no es una fecha valida"
            });
          }
        }
      }

      const finalValidFrom = validFrom !== undefined ? validFrom : existingRule.validFrom;
      const finalValidTo = validTo !== undefined ? validTo : existingRule.validTo;

      if (finalValidTo !== null && finalValidTo < finalValidFrom) {
        return reply.code(400).send({
          error: "validTo no puede ser anterior a validFrom"
        });
      }

      if (body.priority !== undefined) {
        if (typeof body.priority !== "number" || !Number.isInteger(body.priority)) {
          return reply.code(400).send({
            error: "priority debe ser un entero valido"
          });
        }
      }

      try {
        const commissionRule = await prisma.$transaction(
          async (tx) => {
            const overlappingRules = await tx.commissionRule.findMany({
              where: {
                id: { not: id },
                radiologyCenterId: existingRule.radiologyCenterId,
                examId: existingRule.examId,
                dentistId: existingRule.dentistId,
                isActive: true,
                OR: [
                  {
                    AND: [
                      { validFrom: { lte: finalValidFrom } },
                      {
                        OR: [
                          { validTo: null },
                          { validTo: { gte: finalValidFrom } }
                        ]
                      }
                    ]
                  },
                  {
                    AND: [
                      { validFrom: { lte: finalValidTo || new Date("9999-12-31") } },
                      {
                        OR: [
                          { validTo: null },
                          { validTo: { gte: finalValidTo || new Date("9999-12-31") } }
                        ]
                      }
                    ]
                  },
                  {
                    AND: [
                      { validFrom: { gte: finalValidFrom } },
                      finalValidTo !== null
                        ? { validFrom: { lte: finalValidTo } }
                        : {}
                    ]
                  }
                ]
              }
            });

            if (overlappingRules.length > 0) {
              throw new Error("OVERLAPPING_RULE");
            }

            const updateData: {
              commissionType?: "PERCENTAGE" | "FIXED" | "NONE";
              percentage?: number | null;
              fixedAmount?: number | null;
              validFrom?: Date;
              validTo?: Date | null;
              isActive?: boolean;
              priority?: number;
            } = {};

            if (newCommissionType !== undefined) {
              updateData.commissionType = newCommissionType;
            }

            if (newCommissionType === "PERCENTAGE" || (newCommissionType === undefined && existingCommissionType === "PERCENTAGE")) {
              updateData.percentage = percentageValue;
              updateData.fixedAmount = null;
            } else if (newCommissionType === "FIXED" || (newCommissionType === undefined && existingCommissionType === "FIXED")) {
              updateData.fixedAmount = fixedAmountValue;
              updateData.percentage = null;
            } else if (newCommissionType === "NONE" || (newCommissionType === undefined && existingCommissionType === "NONE")) {
              updateData.percentage = null;
              updateData.fixedAmount = null;
            }

            if (validFrom !== undefined) updateData.validFrom = validFrom;
            if (validTo !== undefined) updateData.validTo = validTo;
            if (body.isActive !== undefined) updateData.isActive = body.isActive;
            if (body.priority !== undefined) updateData.priority = body.priority;

            return updateCommissionRuleInTx(id, updateData, tx);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );

        if (!commissionRule) {
          return reply.code(404).send({
            error: "Regla de comision no encontrada"
          });
        }

        return reply.code(200).send(commissionRule);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.message === "OVERLAPPING_RULE") {
          return reply.code(409).send({
            error: "Ya existe una regla activa con periodos de vigencia superpuestos para el mismo alcance"
          });
        }
        if (err.code === "P2002") {
          return reply.code(409).send({
            error: "Ya existe una regla con la misma configuracion"
          });
        }
        if (err.code === "P2034") {
          return reply.code(409).send({
            error: "Conflicto de concurrencia, intente nuevamente"
          });
        }
        throw error;
      }
    }
  );

  app.delete(
    "/commission-rules/:id",
    {
      preHandler: [authenticate, requireRoles(["ADMIN"])]
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const commissionRule = await deleteCommissionRule(id);

      if (!commissionRule) {
        return reply.code(404).send({
          error: "Regla de comisión no encontrada"
        });
      }

      return reply.code(200).send(commissionRule);
    }
  );
}
