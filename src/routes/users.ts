import { FastifyInstance, FastifyRequest } from "fastify";
import { UserController } from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { adminOnly } from "../middleware/admin";
import { logInfo } from "../utils/logger";

// Common schemas
const unauthorizedResponse = {
  type: "object",
  properties: {
    statusCode: { type: "number", default: 401 },
    error: { type: "string", default: "Unauthorized" },
    message: { type: "string" },
  },
};

const forbiddenResponse = {
  type: "object",
  properties: {
    statusCode: { type: "number", default: 403 },
    error: { type: "string", default: "Forbidden" },
    message: { type: "string" },
  },
};

const notFoundResponse = {
  type: "object",
  properties: {
    statusCode: { type: "number", default: 404 },
    error: { type: "string", default: "Not Found" },
    message: { type: "string" },
  },
};

// Common user response schema
const userResponseSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    avatar: { type: "string", nullable: true },
    role: { type: "string", enum: ["USER", "ADMIN"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

// Schema for getting a single user
const getUserSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", pattern: "^\\d+$" },
    },
  },
  response: {
    200: userResponseSchema,
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

// Schema for creating a user
const createUserSchema = {
  body: {
    type: "object",
    required: ["name", "email", "password", "confirmPassword"],
    properties: {
      name: { type: "string", minLength: 2 },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
      confirmPassword: { type: "string", minLength: 6 },
      avatar: { type: "string", nullable: true },
      role: { type: "string", enum: ["USER", "ADMIN"], default: "USER" },
    },
  },
  response: {
    201: userResponseSchema,
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
        details: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
};

// Schema for updating a user
const updateUserSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", pattern: "^\\d+$" },
    },
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2 },
      email: { type: "string", format: "email" },
      avatar: { type: "string", nullable: true },
      role: { type: "string", enum: ["USER", "ADMIN"] },
    },
  },
  response: {
    200: userResponseSchema,
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
        details: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    403: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

// Schema for deleting a user
const deleteUserSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", pattern: "^\\d+$" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
    403: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

export default async function userRoutes(fastify: FastifyInstance) {
  // Get all users (Admin only)
  fastify.get("/users", {
    schema: {
      response: {
        200: {
          type: "array",
          items: userResponseSchema,
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
      },
    },
    preHandler: [authenticate, adminOnly],
    handler: (request, reply) => UserController.getAllUsers(request, reply),
  });

  // Get current user profile
  fastify.get("/profile", {
    schema: {
      response: {
        200: userResponseSchema,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
    preHandler: [authenticate],
    handler: (request, reply) => UserController.getProfile(request, reply),
  });

  // Get user by ID (Admin only)
  fastify.get<{ Params: { id: string } }>("/:id", {
    schema: {
      ...getUserSchema,
      response: {
        200: userResponseSchema,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
    preHandler: [authenticate, adminOnly],
    handler: (request, reply) =>
      UserController.getUserById(
        request as FastifyRequest<{ Params: { id: string } }>,
        reply
      ),
  });

  // Create user (Admin only)
  fastify.post<{
    Body: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      avatar?: string;
      role: "USER" | "ADMIN";
    };
  }>("/", {
    schema: {
      ...createUserSchema,
      response: {
        201: userResponseSchema,
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
      },
    },
    preHandler: [authenticate, adminOnly],
    handler: (request, reply) => {
      // Ensure role has a default value before passing to controller
      const bodyWithDefaultRole = {
        ...request.body,
        role: request.body.role || "USER",
      };

      const typedRequest = {
        ...request,
        body: bodyWithDefaultRole,
      } as FastifyRequest<{
        Body: {
          name: string;
          email: string;
          password: string;
          confirmPassword: string;
          avatar?: string;
          role: "USER" | "ADMIN";
        };
      }>;

      return UserController.createUser(typedRequest, reply);
    },
  });

  // Update user
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      email?: string;
      avatar?: string;
      role?: "USER" | "ADMIN";
    };
  }>("/:id", {
    schema: {
      ...updateUserSchema,
      response: {
        200: userResponseSchema,
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
    preHandler: [authenticate],
    handler: (request, reply) =>
      UserController.updateUser(
        request as FastifyRequest<{
          Params: { id: string };
          Body: {
            name?: string;
            email?: string;
            avatar?: string;
            role?: "USER" | "ADMIN";
          };
        }>,
        reply
      ),
  });

  // Upload user avatar
  fastify.post<{ Params: { id: string } }>("/:id/avatar", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", pattern: "^\\d+$" },
        },
      },
      consumes: ["multipart/form-data"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            avatarUrl: { type: "string" },
            user: userResponseSchema,
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
    preHandler: [authenticate],
    handler: (request, reply) =>
      UserController.uploadAvatar(
        request as FastifyRequest<{ Params: { id: string } }>,
        reply
      ),
  });

  // Delete user (Admin only)
  fastify.delete<{ Params: { id: string } }>("/:id", {
    schema: {
      ...deleteUserSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
      },
    },
    preHandler: [authenticate, adminOnly],
    handler: (request, reply) =>
      UserController.deleteUser(
        request as FastifyRequest<{ Params: { id: string } }>,
        reply
      ),
  });
}
