import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GuestPayload } from './types/guest-payload.type';
import { AUTH_COOKIE_NAME, COOKIE_MAX_AGE_MS } from './guard/guest-auth.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createGuestSession(res: Response) {
    const guestId = randomUUID();
    await this.prisma.user.create({ data: { id: guestId } });

    const jwt = await this.jwtService.signAsync({
      sub: guestId,
      guest: true as const,
    });

    const isProd =
      this.configService.get<string>('NODE_ENV', 'development') ===
      'production';
    const crossSite = this.configService.get<boolean>('CROSS_SITE_AUTH', false);

    res.cookie(AUTH_COOKIE_NAME, jwt, {
      httpOnly: true,
      sameSite: crossSite ? 'none' : 'lax',
      secure: isProd || crossSite, // sameSite: 'none' requires secure: true
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
    });

    return { guestId };
  }

  getSession(user: GuestPayload) {
    return {
      guestId: user.sub,
      isGuest: true,
      expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
    };
  }
}
