import { Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { GuestPayload } from './types/guest-payload.type';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('guest')
  async createGuestSession(@Res({ passthrough: true }) res: Response) {
    return this.authService.createGuestSession(res);
  }

  @Get('session')
  getSession(@CurrentUser() user: GuestPayload) {
    return this.authService.getSession(user);
  }
}
