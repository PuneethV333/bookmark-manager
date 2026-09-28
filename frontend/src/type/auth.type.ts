import { z } from "zod";

export const Session = z.object({
  guestId: z.string(),
  isGuest: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
});

export type sessionType = z.infer<typeof Session>;

export const GuestSessionResponse = z.object({
  guestId: z.string(),
});

export type guestSessionResponseType = z.infer<typeof GuestSessionResponse>;
