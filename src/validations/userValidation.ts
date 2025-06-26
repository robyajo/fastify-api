import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm Password must be at least 6 characters'),
  avatar: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional().default('USER')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  avatar: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional()
});

export const avatarSchema = z.object({
  filename: z.string(),
  mimetype: z.string().refine(
    (value) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(value),
    'Only JPEG, PNG, GIF, and WebP images are allowed'
  ),
  fieldname: z.literal('avatar')
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AvatarInput = z.infer<typeof avatarSchema>;
