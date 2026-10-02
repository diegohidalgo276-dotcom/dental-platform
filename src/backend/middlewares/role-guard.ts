import { FastifyReply, FastifyRequest } from "fastify";

export const requireRoles = (
  allowedRoles: Array<
    "ADMIN" | "RADIOLOGY_CENTER_ADMIN" | "RADIOLOGY_CENTER_STAFF" | "DENTIST"
  >
) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as {
      sub: string;
      email: string;
      role: "ADMIN" | "RADIOLOGY_CENTER_ADMIN" | "RADIOLOGY_CENTER_STAFF" | "DENTIST";
    };

    if (!allowedRoles.includes(user.role)) {
      return reply.code(403).send({
        error: "Acceso prohibido"
      });
    }
  };
};
