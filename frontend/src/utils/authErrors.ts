import { getErrorMessage } from "../api/apiInstance.api";

// Closing the Google popup isn't an error worth showing.
const SILENT_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/invalid-credential": "Wrong email or password. If you signed up with Google, use Continue with Google.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead, or use Continue with Google.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Could not reach the server. Check your connection.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled for the project yet.",
};

/** Turns a Firebase (or backend sync) error into a message for a toast, or null to stay silent. */
export function authErrorMessage(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code;
  if (code && SILENT_CODES.has(code)) return null;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return getErrorMessage(error);
}
