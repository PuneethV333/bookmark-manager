import axios, { isAxiosError } from "axios";
import { ZodError } from "zod";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 30_000,
});

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
