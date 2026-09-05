import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { GuestPayload } from './types/guest-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  getSession(@CurrentUser() user: GuestPayload) {
    return this.authService.getSession(user);
  }
}
