import { GuestPayload } from '../auth/types/guest-payload.type';

declare global {
  namespace Express {
    interface Request {
      user?: GuestPayload;
    }
  }
}

export {};
