import { Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { FirebaseUser } from '../common/guards/firebase-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sync(@CurrentUser() user: FirebaseUser) {
    return this.authService.sync(user);
  }
}
