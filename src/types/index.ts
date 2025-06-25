import { User, UserRole } from '@prisma/client';

export interface UserPayload {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  avatar?: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  avatar?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'password'>;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: UserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    jwt: {
      user: UserPayload;
    };
  }
}