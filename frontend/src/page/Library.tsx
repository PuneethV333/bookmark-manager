import { useMemo, useState } from "react";
import { FiRefreshCw, FiSearch, FiUploadCloud } from "react-icons/fi";
import { Link } from "react-router-dom";
import BookmarkCard from "../components/BookmarkCard";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import ProgressStrip from "../components/ProgressStrip";
import SearchInput from "../components/SearchInput";
import SelectField from "../components/SelectField";
import type { LibraryChecks } from "../hooks/useLibraryChecks";
import type { Bookmark } from "../type/bookmark.type";
import {
  ALL_SITES,
  applyLibraryView,
  countByStatus,
  getSites,
  type LibraryFilter,
  type SortKey,
} from "../utils/bookmarks";
import { buttonStyles } from "../utils/buttonStyles";
import { formatSite, pluralize } from "../utils/format";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Recently checked" },
  { value: "title", label: "Title A–Z" },
  { value: "chapter", label: "Latest chapter" },
];

interface LibraryProps {
  bookmarks: Bookmark[];
  checks: LibraryChecks;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
}

const Library = ({ bookmarks, checks, filter, onFilterChange }: LibraryProps) => {
  const [query, setQuery] = useState("");
  const [site, setSite] = useState(ALL_SITES);
  const [sort, setSort] = useState<SortKey>("recent");

  const { statusOf, updates, isCheckingAll, checkAll, checkOne, markSeen } = checks;

  const sites = useMemo(() => getSites(bookmarks), [bookmarks]);
  const counts = useMemo(() => countByStatus(bookmarks, statusOf), [bookmarks, statusOf]);

  // A filter whose count dropped to zero (e.g. all updates read) falls back to "all".
  const activeFilter: LibraryFilter = filter !== "all" && counts[filter] === 0 ? "all" : filter;

  const visible = useMemo(
    () => applyLibraryView(bookmarks, { query, site, filter: activeFilter, sort }, statusOf),
    [bookmarks, query, site, activeFilter, sort, statusOf],
  );

  const siteOptions = [
    { value: ALL_SITES, label: "All sources" },
    ...sites.map((value) => ({ value, label: formatSite(value) })),
  ];

  const chips = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "new" as const, label: "New chapters", count: counts.new },
    { value: "checking" as const, label: "Checking", count: counts.checking },
    { value: "issue" as const, label: "Issues", count: counts.issue },
  ].filter((chip) => chip.value === "all" || chip.count > 0);

  const hasRefinement = query.trim() !== "" || site !== ALL_SITES || activeFilter !== "all";

  const clearRefinement = () => {
    setQuery("");
    setSite(ALL_SITES);
    onFilterChange("all");
  };

  return (
    <section aria-label="Library" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-2">
          <Button
            variant="primary"
            loading={isCheckingAll}
            icon={<FiRefreshCw aria-hidden />}
            onClick={() => void checkAll()}
          >
            {isCheckingAll ? "Checking sources…" : "Check for updates"}
          </Button>
          <Link to="/" className={buttonStyles({ variant: "secondary" })}>
            <FiUploadCloud aria-hidden />
            Import more
          </Link>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 lg:ml-auto lg:max-w-2xl lg:grid-cols-[1fr_auto_auto]">
          <div className="col-span-2 lg:col-span-1">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <SelectField label="Filter by source" value={site} options={siteOptions} onChange={setSite} />
          <SelectField label="Sort by" value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </div>
      </div>

      <FilterChips label="Filter by status" value={activeFilter} chips={chips} onChange={onFilterChange} />

      {isCheckingAll && (
        <ProgressStrip
          label={`Checking ${bookmarks.length} ${pluralize(bookmarks.length, "series", "series")} across ${sites.length} ${pluralize(sites.length, "source")}…`}
        />
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<FiSearch aria-hidden />}
          title="No series match"
          description="Try a different search, source or status."
          action={
            hasRefinement && (
              <Button variant="secondary" onClick={clearRefinement}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((bookmark) => (
            <li key={bookmark.id}>
              <BookmarkCard
                bookmark={bookmark}
                status={statusOf(bookmark.id)}
                update={updates.get(bookmark.id)}
                onCheck={checkOne}
                onOpen={(item) => markSeen(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default Library;
