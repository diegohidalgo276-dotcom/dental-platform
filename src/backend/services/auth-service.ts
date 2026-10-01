import bcrypt from "bcrypt";
import prisma from "../prisma/client";

export const authenticateUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordValid = await bcrypt.compare(password, user.password);

  if (!passwordValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
};
