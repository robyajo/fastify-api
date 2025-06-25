import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate, adminOnly } from '../middleware/auth';
import { UserService } from '../services/userService';
import { CreateUserRequest, UpdateUserRequest } from '../types';
import { logError, logInfo } from '../utils/logger';
import { handleFileUpload, getAvatarUrl } from '../utils/fileUpload';
const userService = new UserService();

const userSchema = {
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
};

const createUserSchema = {
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
  },
  response: {
    201: userSchema
  }
};

const updateUserSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 2 },
      avatar: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'ADMIN'] }
    }
  },
  response: {
    200: userSchema
  }
};

const getUserSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    }
  },
  response: {
    200: userSchema
  }
};

const deleteUserSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export default async function userRoutes(fastify: FastifyInstance) {
  // Get all users (Admin only)
  fastify.get('/users', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: userSchema
        }
      }
    },
    preHandler: [authenticate, adminOnly],
    handler: async (request, reply) => {
      try {
        logInfo('Fetching all users');
        const users = await userService.getAllUsers();
        logInfo(`Successfully fetched ${users.length} users`);
        reply.send(users);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Error fetching users', error);
        reply.status(500).send({
          error: 'Internal server error',
          message: errorMessage
        });
      }
    }
  });

  // Get current user profile
  fastify.get('/profile', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: userSchema
      }
    },
    handler: async (request, reply) => {
      try {
        const userId = request.user!.id;
        logInfo(`Fetching profile for user ID: ${userId}`);
        const user = await userService.getUserById(userId);
        logInfo(`Successfully fetched profile for user: ${user.email}`);
        reply.send(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Error fetching user profile', error);
        reply.status(404).send({
          error: 'User not found',
          message: errorMessage
        });
      }
    }
  });
  // Get user by ID (Admin only)
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: getUserSchema,
    preHandler: [authenticate, adminOnly],
    handler: async (request, reply) => {
      const userId = request.params.id;
      try {
        logInfo(`Fetching user with ID: ${userId}`);
        const user = await userService.getUserById(Number(userId));
        if (!user) {
          logError(`User not found with ID: ${userId}`, new Error('User not found'));
          return reply.status(404).send({ error: 'User not found' });
        }
        logInfo(`Successfully fetched user: ${user.email}`);
        reply.send(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError(`Error fetching user with ID ${userId}`, error);
        reply.status(404).send({
          error: 'User not found',
          message: errorMessage
        });
      }
    }
  });

  // Create user (Admin only)
  fastify.post<{ Body: CreateUserRequest }>('/', {
    schema: createUserSchema,
    preHandler: [authenticate, adminOnly],
    handler: async (request, reply) => {
      try {
        logInfo(`Creating new user with email: ${request.body.email}`);
        const user = await userService.createUser(request.body);
        logInfo(`Successfully created user with ID: ${user.id}`);
        reply.status(201).send(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
        logError('Error creating user', error);
        reply.status(400).send({
          error: 'Bad Request',
          message: errorMessage
        });
      }
    }
  });

  // Update user
  fastify.put<{ Params: { id: string }; Body: UpdateUserRequest }>('/:id', {
    schema: updateUserSchema,
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = parseInt(request.params.id);
      try {
        // Users can only update their own profile unless they're admin
        if (request.user!.role !== 'ADMIN' && request.user!.id !== userId) {
          logError(`Unauthorized update attempt by user ${request.user!.id} for user ${userId}`, new Error('Forbidden'));
          reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only update your own profile'
          });
          return;
        }

        logInfo(`Updating user with ID: ${userId}`, { updates: request.body });
        const user = await userService.updateUser(userId, request.body);
        logInfo(`Successfully updated user with ID: ${userId}`);
        reply.send(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
        logError(`Error updating user ID ${userId}`, error);
        reply.status(400).send({
          error: 'Failed to update user',
          message: errorMessage
        });
      }
    }
  });

  // Upload user avatar
  fastify.post<{ Params: { id: string } }>('/:id/avatar', {
    preHandler: [authenticate],
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = parseInt(request.params.id);
      
      // Check if user is updating their own avatar or is admin
      if (request.user!.role !== 'ADMIN' && request.user!.id !== userId) {
        logError(`Unauthorized avatar update attempt by user ${request.user!.id} for user ${userId}`, new Error('Forbidden'));
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only update your own avatar'
        });
      }

      try {
        logInfo(`Uploading avatar for user ID: ${userId}`);
        
        // Check if the request is multipart/form-data
        if (!request.isMultipart()) {
          logError('Upload request is not multipart', new Error('Invalid content type'));
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Request must be multipart/form-data',
            details: {
              required: 'multipart/form-data',
              received: request.headers['content-type']
            }
          });
        }

        // Handle file upload
        const { fileUrl } = await handleFileUpload(request, userId);
        
        // Update user with new avatar URL
        const user = await userService.updateUser(userId, { avatar: fileUrl });
        
        logInfo(`Successfully uploaded avatar for user ID: ${userId}`, { fileUrl });
        reply.send({
          success: true,
          avatarUrl: fileUrl,
          user
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload avatar';
        logError(`Error uploading avatar for user ID ${userId}`, error);
        reply.status(400).send({
          error: 'Bad Request',
          message: errorMessage
        });
      }
    }
  });

  // Delete user (Admin only)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: deleteUserSchema,
    preHandler: [authenticate, adminOnly],
    handler: async (request, reply) => {
      const userId = parseInt(request.params.id);
      try {
        logInfo(`Deleting user with ID: ${userId}`);
        const result = await userService.deleteUser(userId);
        logInfo(`Successfully deleted user with ID: ${userId}`);
        reply.send(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError(`Error deleting user ID ${userId}`, error);
        reply.status(404).send({
          error: 'User not found',
          message: errorMessage
        });
      }
    }
  });
}