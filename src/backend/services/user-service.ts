import bcrypt from "bcrypt";
import prisma from "../prisma/client";

export type CreateUserInput = {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "RADIOLOGY_CENTER_ADMIN" | "RADIOLOGY_CENTER_STAFF" | "DENTIST";
};

export const createUser = async (input: CreateUserInput) => {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: passwordHash,
      role: input.role
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });
};
