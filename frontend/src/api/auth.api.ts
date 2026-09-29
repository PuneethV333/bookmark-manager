import { SyncResponse, type SyncResponseType } from "../type/auth.type";
import { api } from "./apiInstance.api";

/**
 * POST /auth/sync
 * Creates the user row for the signed-in Firebase user if it doesn't exist.
 * The backend reads the uid from the verified ID token, so no body is sent.
 */
export async function syncUser(): Promise<SyncResponseType> {
  const { data } = await api.post("/auth/sync");
  return SyncResponse.parse(data);
}
