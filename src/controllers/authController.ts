import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/userService';
import { logError, logInfo } from '../utils/logger';
import { handleFileUpload } from '../utils/fileUpload';
import { loginSchema, registerSchema, LoginInput, RegisterInput } from '../validations/authValidation';
import { z } from 'zod';

const userService = new UserService();

export class AuthController {
  static async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply,
    fastify: any
  ) {
    try {
      // Validate request body
      const validatedData = loginSchema.parse(request.body);
      
      logInfo('Login attempt', { email: validatedData.email });
      const user = await userService.loginUser(validatedData);

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      logInfo('Login successful', { userId: user.id, email: user.email });

      return {
        token,
        user,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logError('Validation error during login', error);
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid login data',
          details: errorDetails
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Login failed', error, { email: request.body?.email });

      reply.status(401).send({
        error: 'Authentication failed',
        message: errorMessage,
      });
    }
  }

  static async register(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply,
    fastify: any
  ) {
    try {
      logInfo('Registration attempt', {
        email: request.body?.email,
        name: request.body?.name,
      });

      // Handle file upload if present
      let avatarUrl: string | undefined;

      // Check if this is a multipart form data request (file upload)
      if (request.isMultipart()) {
        try {
          const fileData = await (request as any).file();
          if (fileData) {
            const { fileUrl } = await handleFileUpload(request as any, 0);
            avatarUrl = fileUrl;
          }
        } catch (uploadError) {
          logError('Error processing file upload during registration', uploadError);
          // Continue without avatar if upload fails
        }
      }

      // Validate request body (excluding file upload)
      const validatedData = registerSchema.parse(request.body);
      
      // Prepare user data with validated input and optional avatar
      const userData = {
        ...validatedData,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        // Remove confirmPassword before saving
        confirmPassword: undefined
      };

      const user = await userService.createUser(userData);

      // If we have a file but no user ID yet, update the user with the correct avatar URL
      if (avatarUrl && user.id) {
        const updatedAvatarUrl = avatarUrl.replace('user_0_', `user_${user.id}_`);
        await userService.updateUser(user.id, { avatar: updatedAvatarUrl });
        user.avatar = updatedAvatarUrl;
      }

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      logInfo('Registration successful', {
        userId: user.id,
        email: user.email,
      });

      reply.status(201).send({
        token,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logError('Validation error during registration', error);
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid registration data',
          details: errorDetails
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to register user';
      logError('Registration failed', error, { email: request.body?.email });

      reply.status(400).send({
        error: 'Registration failed',
        message: errorMessage,
      });
    }
  }
}

export const authController = new AuthController();
