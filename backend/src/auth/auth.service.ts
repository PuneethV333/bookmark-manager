// auth/auth.service.ts
import { Injectable } from '@nestjs/common';
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
  ) {}

  async createGuestSession(res: Response) {
    const guestId = randomUUID();
    await this.prisma.user.create({ data: { id: guestId } });

    const jwt = await this.jwtService.signAsync({
      sub: guestId,
      guest: true as const,
    });

    res.cookie(AUTH_COOKIE_NAME, jwt, {
      httpOnly: true,
      sameSite: 'lax', // or your CROSS_SITE_AUTH-driven value
      secure: process.env.NODE_ENV === 'production',
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
