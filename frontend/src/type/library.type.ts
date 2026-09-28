/** A chapter jump found during this session, e.g. Ch. 141 -> Ch. 142. */
export interface NewChapter {
  from: number | null;
  to: number | null;
}
