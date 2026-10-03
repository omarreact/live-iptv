import Link from "next/link";

type Game = {
  id: string;
  sport: string;
  league: string;
  name: string;
  detail: string;
  channel?: string;
};

type ScoreboardEvent = {
  id?: string | number;
  name?: string;
  shortName?: string;
  league?: { abbreviation?: string; name?: string };
  status?: { type?: { state?: string; detail?: string }; displayClock?: string };
  competitions?: Array<{ broadcasts?: Array<{ names?: string[] }> }>;
};

type ScoreboardResponse = { events?: ScoreboardEvent[] };

async function getLiveGames(): Promise<Game[]> {
  const feeds = [
    ["Football", "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard"],
    ["Cricket", "https://site.api.espn.com/apis/site/v2/sports/cricket/all/scoreboard"],
    ["Basketball", "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"],
    ["Hockey", "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"],
    ["Baseball", "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"],
  ] as const;

  const rows = await Promise.all(
    feeds.map(async ([sport, url]): Promise<Game[]> => {
      try {
        const response = await fetch(url, { next: { revalidate: 60 } });
        if (!response.ok) return [];

        const data = (await response.json()) as ScoreboardResponse;
        return (data.events ?? [])
          .filter((event) => event.status?.type?.state === "in")
          .map((event) => ({
            id: String(event.id ?? event.name ?? "event"),
            sport,
            league: event.league?.abbreviation ?? event.league?.name ?? sport,
            name: event.name ?? event.shortName ?? "Live event",
            detail: event.status?.type?.detail ?? event.status?.displayClock ?? "Live",
            channel: event.competitions?.[0]?.broadcasts?.[0]?.names?.[0],
          }));
      } catch {
        return [];
      }
    }),
  );

  return rows.flat().slice(0, 18);
}

export async function LiveGames() {
  const games = await getLiveGames();

  return (
    <section className="games-rail">
      <div className="games-heading">
        <div>
          <span className="live-kicker"><i /> LIVE NOW</span>
          <h2>Games happening right now</h2>
        </div>
        <span className="games-refresh">Updates every minute</span>
      </div>
      {games.length ? (
        <div className="games-scroller">
          {games.map((game) => (
            <article className="game-card" key={game.sport + game.id}>
              <div className="game-top"><span>{game.sport}</span><b>LIVE</b></div>
              <strong>{game.name}</strong>
              <p>{game.league} · {game.detail}</p>
              {game.channel ? (
                <Link href={"/search?q=" + encodeURIComponent(game.channel)}>
                  Find {game.channel} →
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="games-empty">
          <span className="status-dot" />
          <strong>No supported live game metadata right now.</strong>
          <span>This updates automatically as events go live.</span>
        </div>
      )}
    </section>
  );
}
