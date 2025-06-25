import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/userService';
import { LoginRequest, CreateUserRequest } from '../types';
import { logError, logInfo } from '../utils/logger';
import { handleFileUpload } from '../utils/fileUpload';

const userService = new UserService();

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' },
            avatar: { type: 'string' },
            role: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }
};

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      name: { type: 'string', minLength: 2 },
      avatar: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] }
    }
  }
};

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post<{ Body: LoginRequest }>('/login', {
    schema: loginSchema,
    handler: async (request, reply) => {
      try {
        logInfo('Login attempt', { email: request.body.email });
        const user = await userService.loginUser(request.body);
        
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        });

        logInfo('Login successful', { userId: user.id, email: user.email });
        
        reply.send({
          token,
          user
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Login failed', error, { email: request.body.email });
        
        reply.status(401).send({
          error: 'Authentication failed',
          message: errorMessage
        });
      }
    }
  });

  // Register
  fastify.post<{ Body: CreateUserRequest }>('/register', {
    schema: registerSchema,
    handler: async (request: FastifyRequest<{ Body: CreateUserRequest }>, reply: FastifyReply) => {
      try {
        logInfo('Registration attempt', { email: request.body.email, name: request.body.name });
        
        // Handle file upload if present
        let avatarUrl: string | undefined;
        
        // Check if this is a multipart form data request (file upload)
        if (request.isMultipart()) {
          try {
            const fileData = await (request as any).file();
            if (fileData) {
              const { fileUrl } = await handleFileUpload(request as any, 0); // 0 is a temporary user ID, will be updated
              avatarUrl = fileUrl;
            }
          } catch (uploadError) {
            logError('Error processing file upload during registration', uploadError);
            // Don't fail the registration if file upload fails
          }
        }
        
        // Create user with or without avatar
        const userData: CreateUserRequest = {
          ...request.body,
          ...(avatarUrl ? { avatar: avatarUrl } : {}) // Only add avatar if it was uploaded
        };
        
        const user = await userService.createUser(userData);
        
        // If we have a file but no user ID yet, update the user with the correct avatar URL
        if (avatarUrl && user.id) {
          const updatedAvatarUrl = avatarUrl.replace('user_0_', `user_${user.id}_`);
          await userService.updateUser(user.id, { avatar: updatedAvatarUrl });
          
          // Update the user object with the final avatar URL
          (user as any).avatar = updatedAvatarUrl;
        }
        
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        });

        logInfo('Registration successful', { userId: user.id, email: user.email });
        
        reply.status(201).send({
          token,
          user
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Registration failed', error, { email: request.body.email });
        
        reply.status(400).send({
          error: 'Registration failed',
          message: errorMessage
        });
      }
    }
  });
}