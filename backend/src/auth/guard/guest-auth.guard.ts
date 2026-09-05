import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { GuestPayload, GuestPayloadSchema } from '../types/guest-payload.type';

export const AUTH_COOKIE_NAME = 'jwtAuthToken';

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[AUTH_COOKIE_NAME];

    if (token) {
      const payload = await this.verify(token);
      if (payload) {
        req.user = payload;
        return true;
      }
    }

    const guestId = randomUUID();
    const jwt = await this.jwtService.signAsync({
      sub: guestId,
      guest: true as const,
    });
    this.setGuestCookie(res, jwt);
    req.user = { sub: guestId, guest: true };
    return true;
  }

  private async verify(token: string): Promise<GuestPayload | null> {
    try {
      const payload: unknown = await this.jwtService.verifyAsync(token);
      const parsed = GuestPayloadSchema.safeParse(payload);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private setGuestCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        this.configService.get<string>('NODE_ENV', 'development') ===
        'production',
      path: '/',
    });
  }
}
