import { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthController } from '../controllers/authController';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../validations/authValidation';
import { z } from 'zod';

// Common user response schema
const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    avatar: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['USER', 'ADMIN'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

// Helper type for Zod field shape
type ZodFieldShape = {
  _def: {
    typeName: string;
    checks?: Array<{ kind: string }>;
    minLength?: { value: number };
    values?: string[];
  };
  isOptional?: () => boolean;
};

// Convert Zod schema to JSON Schema for Fastify
const zodToJsonSchema = (zodSchema: z.ZodTypeAny) => {
  const jsonSchema = (zodSchema as any)._def.schema || zodSchema;
  const shape = (jsonSchema as any).shape as Record<string, ZodFieldShape>;
  
  return {
    type: 'object',
    properties: Object.entries(shape).reduce((acc, [key, field]) => {
      acc[key] = {
        type: field._def.typeName === 'ZodString' ? 'string' : 'object',
        ...(field._def.checks?.some((c) => c.kind === 'email') && { format: 'email' }),
        ...(field._def.minLength && { minLength: field._def.minLength.value }),
        ...(field._def.values && { enum: field._def.values })
      };
      return acc;
    }, {} as Record<string, any>),
    required: Object.entries(shape)
      .filter(([_, field]) => !field.isOptional?.())
      .map(([key]) => key)
  };
};

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post<{ Body: LoginInput }>('/login', {
    schema: {
      body: zodToJsonSchema(loginSchema),
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: userResponseSchema
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      return AuthController.login(
        request as FastifyRequest<{ Body: LoginInput }>,
        reply,
        fastify
      );
    },
  });

  // Register
  fastify.post<{ Body: RegisterInput }>('/register', {
    schema: {
      body: zodToJsonSchema(registerSchema),
      response: {
        201: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: userResponseSchema
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      return AuthController.register(
        request as FastifyRequest<{ Body: RegisterInput }>,
        reply,
        fastify
      );
    },
  });
}
