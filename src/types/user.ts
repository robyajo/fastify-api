import { CreateUserInput, UpdateUserInput } from '../validations/userValidation';

export interface CreateUserRequest extends Omit<CreateUserInput, 'confirmPassword'> {}

export interface UpdateUserRequest extends UpdateUserInput {}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}
