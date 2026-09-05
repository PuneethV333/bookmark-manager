import { z } from 'zod';

export const GuestPayloadSchema = z.object({
  sub: z.string(),
  guest: z.literal(true),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type GuestPayload = z.infer<typeof GuestPayloadSchema>;
