import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { syncUser } from "../api/auth.api";
import { Auth, googleAuthProvider } from "../config/firebase.config";

/**
 * The single place the app reads the signed-in Firebase user.
 * `uid` is null while loading and when signed out, so check `loading` first.
 */
export function useFirebaseUid() {
  const [user, loading, error] = useAuthState(Auth);
  return { user: user ?? null, uid: user?.uid ?? null, loading, error };
}

/**
 * Runs a Firebase sign-in, then registers the user with the backend.
 * If the backend sync fails we sign out again, so the app never holds a
 * Firebase session the backend hasn't seen.
 */
async function signInAndSync(signIn: () => Promise<UserCredential>) {
  const { user } = await signIn();
  try {
    await syncUser();
  } catch (error) {
    await signOut(Auth);
    throw error;
  }
  return user;
}

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: () => signInAndSync(() => signInWithPopup(Auth, googleAuthProvider)),
  });
}

export type EmailAuthMode = "signin" | "signup";

export interface EmailCredentials {
  mode: EmailAuthMode;
  email: string;
  password: string;
}

/** Email + password: signs in, or creates the account first when mode is "signup". */
export function useEmailAuth() {
  return useMutation({
    mutationFn: ({ mode, email, password }: EmailCredentials) =>
      signInAndSync(() =>
        mode === "signup"
          ? createUserWithEmailAndPassword(Auth, email, password)
          : signInWithEmailAndPassword(Auth, email, password),
      ),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => signOut(Auth),
    // Drop every cached query so the next account never sees this one's data.
    onSuccess: () => queryClient.clear(),
  });
}
