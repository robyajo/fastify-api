import { FastifyRequest, FastifyReply } from 'fastify';
import { UserPayload } from '../types';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = await request.jwtVerify<UserPayload>();
    request.user = token;
  } catch (err) {
    reply.status(401).send({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing token' 
    });
  }
}

export async function adminOnly(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    reply.status(401).send({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
    return;
  }

  if (request.user.role !== 'ADMIN') {
    reply.status(403).send({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
    return;
  }
}