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

  // Register endpoint with file upload support
  fastify.post<{ Body: any }>('/register', {
    schema: {
      consumes: ['multipart/form-data', 'application/json'],
      body: {
        oneOf: [
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 6 },
              confirmPassword: { type: 'string' },
              // For JSON requests
              avatar: { type: 'string', format: 'uri', nullable: true }
            },
            required: ['name', 'email', 'password', 'confirmPassword']
          },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 6 },
              confirmPassword: { type: 'string' },
              // For file uploads
              avatar: { type: 'string', format: 'binary' }
            },
            required: ['name', 'email', 'password', 'confirmPassword']
          }
        ]
      },
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
      try {
        // Validate request body based on content type
        const contentType = request.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
          // For JSON requests, validate against the Zod schema
          const result = registerSchema.safeParse(request.body);
          if (!result.success) {
            const errorDetails = result.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }));
            return reply.status(400).send({
              error: 'Validation Error',
              message: 'Invalid registration data',
              details: errorDetails
            });
          }
        }
        
        // Process the request in the controller
        return AuthController.register(
          request as FastifyRequest<{ Body: any }>,
          reply,
          fastify
        );
      } catch (error) {
        request.log.error('Error in register handler:', error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred'
        });
      }
    },
  });
}
