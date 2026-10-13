import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

type CommissionType = "PERCENTAGE" | "FIXED" | "NONE";

export type OrderExamResponse = {
  id: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  commissionType: string;
  commissionValue: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  status: string;
  examId: string;
  orderId: string;
};

export type AddExamToOrderInput = {
  examId: string;
  quantity: number;
  discount?: number;
};

export async function addExamToOrder(
  orderId: string,
  examData: AddExamToOrderInput
): Promise<OrderExamResponse | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        radiologyCenterId: true,
        dentistId: true
      }
    });

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const examPrice = await getVigentExamPrice(examData.examId, order.radiologyCenterId, tx);

    if (!examPrice) {
      throw new Error("NO_EXAM_PRICE");
    }

    const unitPrice = examPrice.price;
    const discount = new Prisma.Decimal(examData.discount || 0);
    const subtotal = unitPrice.mul(examData.quantity).sub(discount);

    const commissionRule = await getApplicableCommissionRule(
      examData.examId,
      order.radiologyCenterId,
      order.dentistId,
      tx
    );

    let commissionType: CommissionType = "NONE";
    let commissionValue = new Prisma.Decimal(0);
    let commissionAmount = new Prisma.Decimal(0);
    let commissionRuleId: string | null = null;

    if (commissionRule) {
      commissionType = commissionRule.commissionType as CommissionType;
      commissionRuleId = commissionRule.id;

      if (commissionRule.commissionType === "PERCENTAGE" && commissionRule.percentage) {
        commissionValue = commissionRule.percentage;
        commissionAmount = subtotal.mul(commissionRule.percentage).div(100);
      } else if (commissionRule.commissionType === "FIXED" && commissionRule.fixedAmount) {
        commissionValue = commissionRule.fixedAmount;
        commissionAmount = commissionRule.fixedAmount.mul(examData.quantity);
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        totalAmount: {
          increment: subtotal
        }
      },
      select: {
        id: true,
        totalAmount: true
      }
    });

    const orderExam = await tx.orderExam.create({
      data: {
        orderId,
        examId: examData.examId,
        quantity: examData.quantity,
        unitPrice,
        discount,
        subtotal,
        commissionType,
        commissionValue,
        commissionAmount,
        commissionRuleId,
        status: "PENDING"
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        discount: true,
        subtotal: true,
        commissionType: true,
        commissionValue: true,
        commissionAmount: true,
        status: true,
        examId: true,
        orderId: true
      }
    });

    return orderExam;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

export async function getVigentExamPrice(
  examId: string,
  radiologyCenterId: string,
  tx: Prisma.TransactionClient
): Promise<{ price: Prisma.Decimal } | null> {
  const now = new Date();

  return tx.examPrice.findFirst({
    where: {
      examId,
      radiologyCenterId,
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validTo: null },
        { validTo: { gte: now } }
      ]
    },
    select: {
      price: true
    },
    orderBy: {
      validFrom: "desc"
    }
  });
}

export async function getApplicableCommissionRule(
  examId: string,
  radiologyCenterId: string,
  dentistId: string,
  tx: Prisma.TransactionClient
): Promise<{
  id: string;
  commissionType: string;
  percentage: Prisma.Decimal | null;
  fixedAmount: Prisma.Decimal | null;
} | null> {
  const now = new Date();

  const rule = await tx.commissionRule.findFirst({
    where: {
      examId,
      radiologyCenterId,
      dentistId,
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validTo: null },
        { validTo: { gte: now } }
      ]
    },
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true
    },
    orderBy: [
      { priority: "desc" },
      { validFrom: "desc" }
    ]
  });

  if (rule) {
    return rule;
  }

  return tx.commissionRule.findFirst({
    where: {
      examId,
      radiologyCenterId,
      dentistId: null,
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validTo: null },
        { validTo: { gte: now } }
      ]
    },
    select: {
      id: true,
      commissionType: true,
      percentage: true,
      fixedAmount: true
    },
    orderBy: [
      { priority: "desc" },
      { validFrom: "desc" }
    ]
  });
}
