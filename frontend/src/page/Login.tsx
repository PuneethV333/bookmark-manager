import { useState, type FormEvent } from "react";
import { FaGoogle } from "react-icons/fa";
import { FiBookOpen, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import { Navigate, useLocation } from "react-router-dom";
import Badge from "../components/Badge";
import Button from "../components/Button";
import PageLoader from "../components/PageLoader";
import { useEmailAuth, useFirebaseUid, useGoogleSignIn, type EmailAuthMode } from "../hooks/useAuth";
import { authErrorMessage } from "../utils/authErrors";

const DEFAULT_AFTER_LOGIN = "/home";

const inputClass =
  "h-10 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-emerald-400";

const Login = () => {
  const location = useLocation();
  const { uid, loading } = useFirebaseUid();
  const googleSignIn = useGoogleSignIn();
  const emailAuth = useEmailAuth();

  const [mode, setMode] = useState<EmailAuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? DEFAULT_AFTER_LOGIN;
  const busy = googleSignIn.isPending || emailAuth.isPending;

  if (loading) return <PageLoader />;

  // Already signed in (or just finished): go to the page. While a sign-in
  // mutation is pending the backend sync is still running, so wait for it.
  if (uid && !busy) return <Navigate to={from} replace />;

  const onError = (error: unknown) => {
    const message = authErrorMessage(error);
    if (message) toast.error(message);
  };

  const handleGoogle = () => googleSignIn.mutate(undefined, { onError });

  const handleEmail = (event: FormEvent) => {
    event.preventDefault();
    emailAuth.mutate({ mode, email: email.trim(), password }, { onError });
  };

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto grid w-full max-w-4xl flex-1 place-items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-900 px-6 py-10 text-center sm:px-10">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-xl text-emerald-400">
            <FiBookOpen aria-hidden />
          </span>

          <Badge className="mx-auto mt-5" icon={<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}>
            Chapter Tracker
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {isSignup ? "Create your account" : "Sign in to your library"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Import your bookmarks and catch every new chapter.
          </p>

          <Button
            variant="secondary"
            className="mt-8 w-full"
            loading={googleSignIn.isPending}
            disabled={busy}
            icon={<FaGoogle aria-hidden />}
            onClick={handleGoogle}
          >
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 font-mono text-[11px] text-zinc-500">
            <span className="h-px flex-1 bg-ink-600" />
            or
            <span className="h-px flex-1 bg-ink-600" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3 text-left">
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="sr-only">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className={inputClass}
              />
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={emailAuth.isPending}
              disabled={busy}
            >
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-sm text-zinc-400">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isSignup ? "signin" : "signup")}
              className="rounded font-medium text-emerald-400 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </main>

      <footer className="border-t border-ink-700">
        <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 font-mono text-[11px] text-zinc-500 sm:px-6">
          <FiLock aria-hidden />
          Your library is tied to your account, so it follows you to any browser.
        </p>
      </footer>
    </div>
  );
};

export default Login;
