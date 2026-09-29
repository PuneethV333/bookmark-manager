import { FiBookOpen, FiLogOut } from "react-icons/fi";
import { Link, NavLink } from "react-router-dom";
import { useFirebaseUid, useSignOut } from "../hooks/useAuth";
import { cn } from "../utils/cn";
import { pluralize } from "../utils/format";
import Button from "./Button";

const tabs = [
  { to: "/home", label: "Library", end: false },
  { to: "/", label: "Import bookmarks", end: true },
];

interface NavbarProps {
  seriesCount?: number;
  newCount?: number;
}

const Navbar = ({ seriesCount = 0, newCount = 0 }: NavbarProps) => {
  const { uid } = useFirebaseUid();
  const signOut = useSignOut();

  return (
  <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
            <FiBookOpen aria-hidden />
          </span>
          Chapter Tracker
        </Link>

        {seriesCount > 0 && (
          <span className="hidden items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 font-mono text-[11px] text-zinc-400 md:inline-flex">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>
              {seriesCount} {pluralize(seriesCount, "series", "series")} saved
            </span>
            {newCount > 0 && <span className="text-emerald-400">{newCount} new</span>}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <nav aria-label="Primary" className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
          {tabs.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 sm:text-sm",
                  isActive ? "bg-ink-600 text-white" : "text-zinc-400 hover:text-zinc-100",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {uid && (
          <Button
            variant="ghost"
            size="sm"
            icon={<FiLogOut aria-hidden />}
            loading={signOut.isPending}
            onClick={() => signOut.mutate()}
            aria-label="Sign out"
          >
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        )}
      </div>
    </div>
  </header>
  );
};

export default Navbar;
