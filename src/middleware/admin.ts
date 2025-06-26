import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { logError } from '../utils/logger';

export function adminOnly(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  if (request.user?.role !== 'ADMIN') {
    logError('Admin access denied', new Error('Forbidden'), { userId: request.user?.id });
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  done();
}
