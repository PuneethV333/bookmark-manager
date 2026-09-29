import { z } from "zod";

/** Response of POST /auth/sync: the internal user row for the signed-in Firebase user. */
export const SyncResponse = z.object({
  id: z.string(),
});

export type SyncResponseType = z.infer<typeof SyncResponse>;
