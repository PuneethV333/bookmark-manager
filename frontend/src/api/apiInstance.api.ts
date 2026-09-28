import axios, { isAxiosError } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60_000,
});

export function getErrorMessage(error: unknown): string {
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
