// Deprecated — replaced by the new H5 API client in client.ts + service.ts
// This public HTML scraper is no longer used by the entertainment page.

export async function getMovieBoxCatalog() {
  return {
    source: "moviebox-public" as const,
    fetchedAt: new Date().toISOString(),
    rows: [],
  };
}

export async function getMovieBoxDetail() {
  throw new Error("Deprecated");
}
