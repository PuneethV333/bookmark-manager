// auth/guard/guest-auth.guard.ts — now verify-only, no creation
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { GuestPayloadSchema } from '../types/guest-payload.type';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const AUTH_COOKIE_NAME = 'jwtAuthToken';
export const COOKIE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException(
        'No session — call POST /auth/guest first',
      );
    }

    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);
      const parsed = GuestPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new UnauthorizedException('Invalid session');
      }
      req.user = parsed.data;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
