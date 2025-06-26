import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/userService';
import { logError, logInfo } from '../utils/logger';
import { loginSchema, registerSchema, LoginInput, RegisterInput } from '../validations/authValidation';
import { z } from 'zod';
import { MultipartFile } from '@fastify/multipart';

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
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply,
    fastify: any
  ) {
    try {
      const body = request.body || {};
      const email = typeof body === 'object' && 'email' in body ? String(body.email) : 'unknown';
      const name = typeof body === 'object' && 'name' in body ? String(body.name) : 'unknown';
      
      logInfo('Registration attempt', { email, name });

      let avatarUrl: string | undefined;
      let registerData = request.body ? { ...request.body } : {};

      // Handle file upload if present
      if (request.isMultipart()) {
        try {
          const parts = request.parts();
          const formData: Record<string, any> = {};
          
          for await (const part of parts) {
            if (part.type === 'file' && part.filename) {
              // Handle file upload
              const fileName = `${Date.now()}-${part.filename}`;
              const fs = require('fs');
              const path = require('path');
              
              // Ensure upload directory exists
              const uploadDir = path.join(__dirname, '../../storage/uploads');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              
              const filePath = path.join(uploadDir, fileName);
              await fs.promises.writeFile(filePath, await part.toBuffer());
              
              // Set the avatar URL
              avatarUrl = `/uploads/${fileName}`;
            } else if (part.type === 'field') {
              // Handle form fields
              formData[part.fieldname] = part.value;
            }
          }
          
          // Update registerData with form fields
          registerData = {
            ...registerData,
            ...formData
          };
          
        } catch (uploadError) {
          logError('Error processing file upload during registration', uploadError);
          return reply.status(400).send({
            error: 'File Upload Error',
            message: 'Failed to process uploaded file',
            details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
          });
        }
      }

      // Validate the registration data
      const validatedData = registerSchema.safeParse(registerData);
      
      if (!validatedData.success) {
        const errorDetails = validatedData.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logError('Validation error during registration', validatedData.error);
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid registration data',
          details: errorDetails
        });
      }
      
      // Prepare user data with validated input and optional avatar
      const userData = {
        name: validatedData.data.name,
        email: validatedData.data.email,
        password: validatedData.data.password,
        ...(avatarUrl && { avatar: avatarUrl })
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
      const email = request.body && typeof request.body === 'object' && 'email' in request.body 
        ? String(request.body.email) 
        : 'unknown';
      
      logError('Registration failed', error, { email });

      reply.status(400).send({
        error: 'Registration failed',
        message: errorMessage,
      });
    }
  }
}

export const authController = new AuthController();
