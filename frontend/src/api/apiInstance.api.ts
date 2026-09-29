import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";
import { ZodError } from "zod";
import { Auth } from "../config/firebase.config";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
});



api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // On a page reload Firebase restores the session asynchronously, so
    // currentUser is null at first. Wait for it, or the first request goes
    // out without a token and gets a 401.
    await Auth.authStateReady();
    const user = Auth.currentUser;

    if (user) {
      const token = await user.getIdToken();

      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error:Error) => {
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    // The server answered, but not in the shape the client expects.
    return "The server sent an unexpected response.";
  }

  if (isAxiosError<{ message?: string | string[] }>(error)) {
    if (error.response?.status === 429) {
      return "Too many requests. Wait a moment and try again.";
    }

    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;

    if (!error.response) return "Could not reach the server.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}
