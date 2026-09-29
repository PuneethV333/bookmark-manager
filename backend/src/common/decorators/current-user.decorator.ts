import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  FirebaseUser,
  RequestWithUser,
} from '../../common/guards/firebase-auth.guard';

// Safe only on routes protected by FirebaseAuthGuard (all non-@Public routes).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): FirebaseUser => {
    return ctx.switchToHttp().getRequest<RequestWithUser>()
      .user as FirebaseUser;
  },
);
