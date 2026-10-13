import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";

type CommissionType = "PERCENTAGE" | "FIXED" | "NONE";
type OrderStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type OrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  patientId: string;
  dentistId: string;
  radiologyCenterId: string;
};

export type OrderWithExamsResponse = OrderResponse & {
  patient: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  dentist: {
    id: string;
    name: string;
    email: string;
  };
  radiologyCenter: {
    id: string;
    name: string;
  };
  orderExams: Array<{
    id: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    discount: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    commissionType: string;
    commissionValue: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    status: string;
    exam: {
      id: string;
      name: string;
      code: string | null;
    };
  }>;
};

export type CreateOrderInput = {
  patientId: string;
  dentistId: string;
  radiologyCenterId: string;
  notes?: string;
  orderExams: Array<{
    examId: string;
    quantity: number;
    discount?: number;
  }>;
};

export type ListOrdersFilters = {
  status?: OrderStatus;
  dentistId?: string;
  radiologyCenterId?: string;
  patientId?: string;
  page?: number;
  limit?: number;
};

async function getNextOrderNumber(radiologyCenterId: string, tx: Prisma.TransactionClient): Promise<string> {
  const sequence = await tx.sequence.upsert({
    where: {
      radiologyCenterId_sequenceType: {
        radiologyCenterId,
        sequenceType: "ORDER_NUMBER"
      }
    },
    update: {
      currentValue: {
        increment: 1
      }
    },
    create: {
      radiologyCenterId,
      sequenceType: "ORDER_NUMBER",
      currentValue: 1
    }
  });

  const paddedNumber = sequence.currentValue.toString().padStart(6, "0");
  return `ORD-${paddedNumber}`;
}

async function getVigentExamPrice(
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

async function getApplicableCommissionRule(
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

export async function createOrder(data: CreateOrderInput): Promise<OrderWithExamsResponse> {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await getNextOrderNumber(data.radiologyCenterId, tx);

    let totalAmount = new Prisma.Decimal(0);
    const orderExamsData: Array<{
      examId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      commissionType: CommissionType;
      commissionValue: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
      commissionRuleId: string | null;
    }> = [];

    for (const examInput of data.orderExams) {
      const examPrice = await getVigentExamPrice(examInput.examId, data.radiologyCenterId, tx);

      if (!examPrice) {
        throw new Error(`NO_EXAM_PRICE:${examInput.examId}`);
      }

      const unitPrice = examPrice.price;
      const discount = new Prisma.Decimal(examInput.discount || 0);
      const subtotal = unitPrice.mul(examInput.quantity).sub(discount);

      const commissionRule = await getApplicableCommissionRule(
        examInput.examId,
        data.radiologyCenterId,
        data.dentistId,
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
          commissionAmount = commissionRule.fixedAmount.mul(examInput.quantity);
        }
      }

      totalAmount = totalAmount.add(subtotal);

      orderExamsData.push({
        examId: examInput.examId,
        quantity: examInput.quantity,
        unitPrice,
        discount,
        subtotal,
        commissionType,
        commissionValue,
        commissionAmount,
        commissionRuleId
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        patientId: data.patientId,
        dentistId: data.dentistId,
        radiologyCenterId: data.radiologyCenterId,
        totalAmount,
        notes: data.notes || null,
        status: "PENDING"
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        patientId: true,
        dentistId: true,
        radiologyCenterId: true,
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        dentist: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        radiologyCenter: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const createdOrderExams = [];
    for (const examData of orderExamsData) {
      const orderExam = await tx.orderExam.create({
        data: {
          orderId: order.id,
          examId: examData.examId,
          quantity: examData.quantity,
          unitPrice: examData.unitPrice,
          discount: examData.discount,
          subtotal: examData.subtotal,
          commissionType: examData.commissionType,
          commissionValue: examData.commissionValue,
          commissionAmount: examData.commissionAmount,
          commissionRuleId: examData.commissionRuleId,
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
          exam: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      createdOrderExams.push(orderExam);
    }

    return {
      ...order,
      orderExams: createdOrderExams
    } as OrderWithExamsResponse;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

export async function getOrderById(id: string): Promise<OrderWithExamsResponse | null> {
  return prisma.order.findFirst({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      patientId: true,
      dentistId: true,
      radiologyCenterId: true,
      patient: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      dentist: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      radiologyCenter: {
        select: {
          id: true,
          name: true
        }
      },
      orderExams: {
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
          exam: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function listOrders(filters: ListOrdersFilters): Promise<{
  data: OrderResponse[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Number.isInteger(filters.page) && filters.page! > 0 ? filters.page! : 1);
  const limit = Math.max(1, Math.min(Number.isInteger(filters.limit) && filters.limit! > 0 ? filters.limit! : 20, 100));
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    ...(filters.status && { status: filters.status as any }),
    ...(filters.dentistId && { dentistId: filters.dentistId }),
    ...(filters.radiologyCenterId && { radiologyCenterId: filters.radiologyCenterId }),
    ...(filters.patientId && { patientId: filters.patientId })
  };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        patientId: true,
        dentistId: true,
        radiologyCenterId: true
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit
    }),
    prisma.order.count({ where })
  ]);

  return {
    data,
    total,
    page,
    limit
  };
}
