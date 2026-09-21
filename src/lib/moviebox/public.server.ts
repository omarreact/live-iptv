import "server-only";

/** @deprecated — replaced by the H5 API client */
export async function getMovieBoxCatalog() {
  return {
    source: "moviebox-public" as const,
    fetchedAt: new Date().toISOString(),
    rows: [] as any[],
  };
}

/** @deprecated */
export async function getMovieBoxDetail(_href?: string) {
  throw new Error("Deprecated — use the new MovieBox H5 API");
}
