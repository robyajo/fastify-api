import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/userService';
import { CreateUserRequest, UpdateUserRequest } from '../types';
import { logError, logInfo } from '../utils/logger';
import { handleFileUpload } from '../utils/fileUpload';
import { createUserSchema, updateUserSchema, avatarSchema, CreateUserInput, UpdateUserInput, AvatarInput } from '../validations/userValidation';
import { z } from 'zod';

const userService = new UserService();

export class UserController {
  static async getAllUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      logInfo('Fetching all users');
      const users = await userService.getAllUsers();
      logInfo(`Successfully fetched ${users.length} users`);
      return users;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Error fetching users', error);
      reply.status(500).send({
        error: 'Internal server error',
        message: errorMessage
      });
    }
  }

  static async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id;
      logInfo(`Fetching profile for user ID: ${userId}`);
      const user = await userService.getUserById(userId);
      logInfo(`Successfully fetched profile for user: ${user.email}`);
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Error fetching user profile', error);
      reply.status(404).send({
        error: 'User not found',
        message: errorMessage
      });
    }
  }

  static async getUserById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.params.id;
    try {
      logInfo(`Fetching user with ID: ${userId}`);
      const user = await userService.getUserById(Number(userId));
      if (!user) {
        logError(`User not found with ID: ${userId}`, new Error('User not found'));
        return reply.status(404).send({ error: 'User not found' });
      }
      logInfo(`Successfully fetched user: ${user.email}`);
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`Error fetching user with ID ${userId}`, error);
      reply.status(404).send({
        error: 'User not found',
        message: errorMessage
      });
    }
  }

  static async createUser(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply
  ) {
    try {
      // Validate request body
      const validatedData = createUserSchema.parse(request.body);
      
      // Remove confirmPassword before passing to service and set default role if not provided
      const { confirmPassword, ...userData } = {
        ...validatedData,
        role: validatedData.role || 'USER' // Ensure role has a default value
      };
      
      logInfo(`Creating new user with email: ${userData.email}`);
      const user = await userService.createUser(userData);
      logInfo(`Successfully created user with ID: ${user.id}`);
      
      reply.status(201).send(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logError('Validation error creating user', error);
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: errorDetails
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      logError('Error creating user', error);
      reply.status(400).send({
        error: 'Bad Request',
        message: errorMessage
      });
    }
  }

  static async updateUser(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserInput }>,
    reply: FastifyReply
  ) {
    const userId = parseInt(request.params.id);
    try {
      // Users can only update their own profile unless they're admin
      if (request.user!.role !== 'ADMIN' && request.user!.id !== userId) {
        logError(
          `Unauthorized update attempt by user ${request.user!.id} for user ${userId}`,
          new Error('Forbidden')
        );
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only update your own profile'
        });
      }

      // Validate request body
      const validatedData = updateUserSchema.parse(request.body);

      logInfo(`Updating user with ID: ${userId}`, { updates: validatedData });
      const user = await userService.updateUser(userId, validatedData);
      logInfo(`Successfully updated user with ID: ${userId}`);
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
      logError(`Error updating user ID ${userId}`, error);
      reply.status(400).send({
        error: 'Failed to update user',
        message: errorMessage
      });
    }
  }

  static async uploadAvatar(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const userId = parseInt(request.params.id);

    // Check if user is updating their own avatar or is admin
    if (request.user!.role !== 'ADMIN' && request.user!.id !== userId) {
      logError(
        `Unauthorized avatar update attempt by user ${request.user!.id} for user ${userId}`,
        new Error('Forbidden')
      );
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

      // Get the uploaded file
      const fileData = await (request as any).file();
      
      if (!fileData) {
        throw new Error('No file uploaded');
      }

      // Validate file using Zod
      const fileValidation = avatarSchema.safeParse({
        filename: fileData.filename,
        mimetype: fileData.mimetype,
        fieldname: fileData.fieldname
      });

      if (!fileValidation.success) {
        const errorDetails = fileValidation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logError('Invalid file upload', fileValidation.error);
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid file upload',
          details: errorDetails
        });
      }

      // Handle file upload
      const { fileUrl } = await handleFileUpload(request, userId);
      
      // Update user with new avatar URL
      const user = await userService.updateUser(userId, { avatar: fileUrl });
      
      logInfo(`Successfully uploaded avatar for user ID: ${userId}`, { fileUrl });
      return {
        success: true,
        avatarUrl: fileUrl,
        user
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload avatar';
      logError(`Error uploading avatar for user ID ${userId}`, error);
      reply.status(400).send({
        error: 'Bad Request',
        message: errorMessage
      });
    }
  }

  static async deleteUser(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const userId = parseInt(request.params.id);
    try {
      logInfo(`Deleting user with ID: ${userId}`);
      const result = await userService.deleteUser(userId);
      logInfo(`Successfully deleted user with ID: ${userId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`Error deleting user ID ${userId}`, error);
      reply.status(404).send({
        error: 'User not found',
        message: errorMessage
      });
    }
  }
}

export const userController = new UserController();
