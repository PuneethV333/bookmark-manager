import { Injectable } from '@nestjs/common';
import { GuestPayload } from './types/guest-payload.type';

@Injectable()
export class AuthService {
  getSession(user: GuestPayload) {
    return {
      guestId: user.sub,
      isGuest: true,
      expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
    };
  }
}
