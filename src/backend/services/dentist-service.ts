import prisma from "../prisma/client";

export type DentistResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  licenseNumber: string;
  taxId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDentistInput = {
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  licenseNumber: string;
  taxId?: string;
  userId: string;
};

export type UpdateDentistInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  specialty?: string | null;
  licenseNumber?: string;
  taxId?: string | null;
  isActive?: boolean;
};

export async function listDentists(): Promise<DentistResponse[]> {
  return prisma.dentist.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      licenseNumber: true,
      taxId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getDentistById(id: string): Promise<DentistResponse | null> {
  return prisma.dentist.findFirst({
    where: {
      id,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      licenseNumber: true,
      taxId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createDentist(data: CreateDentistInput): Promise<DentistResponse> {
  return prisma.dentist.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      specialty: data.specialty || null,
      licenseNumber: data.licenseNumber,
      taxId: data.taxId || null,
      userId: data.userId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      licenseNumber: true,
      taxId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updateDentist(id: string, data: UpdateDentistInput): Promise<DentistResponse | null> {
  const dentist = await getDentistById(id);
  if (!dentist) {
    return null;
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.specialty !== undefined) updateData.specialty = data.specialty;
  if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
  if (data.taxId !== undefined) updateData.taxId = data.taxId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.dentist.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      licenseNumber: true,
      taxId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function deleteDentist(id: string): Promise<DentistResponse | null> {
  const dentist = await getDentistById(id);
  if (!dentist) {
    return null;
  }

  return prisma.dentist.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      licenseNumber: true,
      taxId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}