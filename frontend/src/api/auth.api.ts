  import { Session, type guestSessionResponseType, type sessionType } from "../type/auth.type";
import { api } from "./apiInstance.api";

export const createGuestSessionApi = async (): Promise<sessionType> => {
  const { data } = await api.post<guestSessionResponseType>("/auth/guest");
  return {
    guestId: data.guestId,
    isGuest: true,
    expiresAt: null,
  };
};

export async function getSession(): Promise<sessionType | null> {
  const response = await api.get<sessionType>("/auth/session", {
    validateStatus: (status) => status === 200 || status === 401,
  });

    return response.status === 200 ? Session.parse(response.data) : null

}

export async function ensureSession(): Promise<sessionType> {
  return (await getSession()) ?? (await createGuestSessionApi());
}
