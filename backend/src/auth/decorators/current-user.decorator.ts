import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GuestPayload, GuestPayloadSchema } from '../types/guest-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GuestPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    const result = GuestPayloadSchema.safeParse(req.user);
    if (!result.success) {
      throw new UnauthorizedException('Invalid or missing session');
    }
    return result.data;
  },
);
