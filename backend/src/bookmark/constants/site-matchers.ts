export const SITE_MATCHERS: Record<
  string,
  (url: string) => string | undefined
> = {
  'asurascans.com': (url) => url.match(/\/comics\/([^/?]+)/)?.[1],
  'kingofshojo.com': (url) => url.match(/\/manga\/([^/?]+)/)?.[1],
};
