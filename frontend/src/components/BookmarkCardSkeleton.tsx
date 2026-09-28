const BookmarkCardSkeleton = () => (
  <div aria-hidden className="animate-pulse overflow-hidden rounded-xl border border-ink-700 bg-ink-900 motion-reduce:animate-none">
    <div className="aspect-[16/10] bg-ink-800" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 rounded bg-ink-700" />
      <div className="h-7 w-1/3 rounded bg-ink-700" />
      <div className="h-3 w-1/2 rounded bg-ink-800" />
      <div className="h-10 rounded-lg bg-ink-800" />
    </div>
  </div>
);

export default BookmarkCardSkeleton;
