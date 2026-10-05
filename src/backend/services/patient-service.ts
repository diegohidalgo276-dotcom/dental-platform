import prisma from "../prisma/client";

export type PatientResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  birthDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePatientInput = {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  birthDate?: Date;
};

export type UpdatePatientInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  birthDate?: Date | null;
  isActive?: boolean;
};

export async function listPatients(): Promise<PatientResponse[]> {
  return prisma.patient.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      document: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getPatientById(id: string): Promise<PatientResponse | null> {
  return prisma.patient.findFirst({
    where: {
      id,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      document: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createPatient(data: CreatePatientInput): Promise<PatientResponse> {
  return prisma.patient.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      document: data.document || null,
      birthDate: data.birthDate || null,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      document: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updatePatient(id: string, data: UpdatePatientInput): Promise<PatientResponse | null> {
  const patient = await getPatientById(id);
  if (!patient) {
    return null;
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.document !== undefined) updateData.document = data.document;
  if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.patient.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      document: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function deletePatient(id: string): Promise<PatientResponse | null> {
  const patient = await getPatientById(id);
  if (!patient) {
    return null;
  }

  return prisma.patient.update({
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
      document: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}