import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GuestPayload } from '../types/guest-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GuestPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: GuestPayload }>();
    return req.user as GuestPayload;
  },
);
