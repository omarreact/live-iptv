/**
 * REMOVED
 * Old public HTML scraper has been fully replaced by the H5 API client:
 *   src/lib/moviebox/client.ts
 *   src/lib/moviebox/service.ts
 */
import "server-only";

export async function getMovieBoxCatalog() {
  return {
    source: "moviebox-public" as const,
    fetchedAt: new Date().toISOString(),
    rows: [] as never[],
  };
}

export async function getMovieBoxDetail(_href?: string) {
  throw new Error("Deprecated — use the new MovieBox H5 API (/api/moviebox/*)");
}
