import prisma from "../prisma/client";

export type RadiologyCenterResponse = {
  id: string;
  name: string;
  taxId: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateRadiologyCenterInput = {
  name: string;
  taxId: string;
  address?: string;
  phone?: string;
  email?: string;
};

export type UpdateRadiologyCenterInput = {
  name?: string;
  taxId?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
};

export async function listRadiologyCenters(): Promise<RadiologyCenterResponse[]> {
  return prisma.radiologyCenter.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getRadiologyCenterById(id: string): Promise<RadiologyCenterResponse | null> {
  return prisma.radiologyCenter.findFirst({
    where: {
      id,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createRadiologyCenter(data: CreateRadiologyCenterInput): Promise<RadiologyCenterResponse> {
  return prisma.radiologyCenter.create({
    data: {
      name: data.name,
      taxId: data.taxId,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updateRadiologyCenter(id: string, data: UpdateRadiologyCenterInput): Promise<RadiologyCenterResponse | null> {
  const center = await getRadiologyCenterById(id);
  if (!center) {
    return null;
  }

  const updateData: Record<string, unknown> = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.taxId !== undefined) updateData.taxId = data.taxId;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.radiologyCenter.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function deleteRadiologyCenter(id: string): Promise<RadiologyCenterResponse | null> {
  const center = await getRadiologyCenterById(id);
  if (!center) {
    return null;
  }

  return prisma.radiologyCenter.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false
    },
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
