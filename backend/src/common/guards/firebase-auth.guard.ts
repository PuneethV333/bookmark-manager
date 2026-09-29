import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initFirebase } from '../../config/firebase.config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface FirebaseUser {
  firebaseUid: string;
}

export interface RequestWithUser extends Request {
  user?: FirebaseUser;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    initFirebase();

    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      request.user = { firebaseUid: decoded.uid };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
