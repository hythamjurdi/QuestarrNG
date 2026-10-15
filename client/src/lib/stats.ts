import { getInterfaceCollator, type InterfaceLanguage } from "@/lib/interface-locale";
import { formatRegionalNumber } from "@/lib/regional-format";
import { type Game } from "@shared/schema";

export interface LibraryStats {
  totalGames: number;
  uniqueGenres: number;
  uniquePlatforms: number;
  avgRating: string;
  avgUserRating: string;
  topGenre: { name: string; count: number } | null;
  topPlatform: { name: string; count: number } | null;
  topPublisher: { name: string; count: number } | null;
  uniqueDevelopers: number;
  avgReleaseYear: string | number;
  metadataHealth: number;
  statusBreakdown: {
    wanted: number;
    owned: number;
    playing: number;
    shelved: number;
    completed: number;
    downloading: number;
  };
  completionRate: number;
}

export function calculateLibraryStats(
  games: Game[],
  regionalPreference?: string,
  interfaceLanguage: InterfaceLanguage = "en"
): LibraryStats {
  const totalGames = games.length;

  if (totalGames === 0) {
    return {
      totalGames: 0,
      uniqueGenres: 0,
      uniquePlatforms: 0,
      avgRating: "N/A",
      avgUserRating: "N/A",
      topGenre: null,
      topPlatform: null,
      topPublisher: null,
      uniqueDevelopers: 0,
      avgReleaseYear: "N/A",
      metadataHealth: 0,
      statusBreakdown: {
        wanted: 0,
        owned: 0,
        playing: 0,
        shelved: 0,
        completed: 0,
        downloading: 0,
      },
      completionRate: 0,
    };
  }

  // ⚡ Bolt: Consolidate multiple O(N) array traversals (filter, map, reduce, flatMap)
  // into a single manual loop to prevent redundant iteration and allocations during React renders.
  let ratingSum = 0;
  let ratedCount = 0;
  let userRatingSum = 0;
  let userRatedCount = 0;

  const genreCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  const publisherCounts: Record<string, number> = {};
  const uniqueGenres = new Set<string>();
  const uniquePlatforms = new Set<string>();
  const uniqueDevelopers = new Set<string>();

  let yearSum = 0;
  let yearCount = 0;
  let completeGamesCount = 0;

  const statusBreakdown = {
    wanted: 0,
    owned: 0,
    playing: 0,
    shelved: 0,
    completed: 0,
    downloading: 0,
  };

  for (const g of games) {
    if (g.rating !== null && g.rating !== undefined) {
      ratingSum += g.rating;
      ratedCount++;
    }
    if (g.userRating !== null && g.userRating !== undefined) {
      userRatingSum += g.userRating;
      userRatedCount++;
    }

    if (g.genres) {
      for (const genre of g.genres) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        uniqueGenres.add(genre);
      }
    }
    if (g.platforms) {
      for (const platform of g.platforms) {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        uniquePlatforms.add(platform);
      }
    }
    if (g.publishers) {
      for (const publisher of g.publishers) {
        publisherCounts[publisher] = (publisherCounts[publisher] || 0) + 1;
      }
    }
    if (g.developers) {
      for (const developer of g.developers) {
        uniqueDevelopers.add(developer);
      }
    }

    if (g.releaseDate) {
      // ⚡ Bolt: Use fast string prefix parsing instead of slow new Date() allocation
      const year = Number.parseInt(g.releaseDate.substring(0, 4), 10);
      if (!Number.isNaN(year)) {
        yearSum += year;
        yearCount++;
      }
    }

    if (
      g.title &&
      g.summary &&
      g.coverUrl &&
      g.releaseDate &&
      g.rating !== null &&
      g.rating !== undefined
    ) {
      completeGamesCount++;
    }

    if (g.status === "wanted") statusBreakdown.wanted++;
    else if (g.status === "owned") statusBreakdown.owned++;
    else if (g.status === "playing") statusBreakdown.playing++;
    else if (g.status === "shelved") statusBreakdown.shelved++;
    else if (g.status === "completed") statusBreakdown.completed++;
    else if (g.status === "downloading") statusBreakdown.downloading++;
  }

  const avgRating =
    ratedCount > 0
      ? formatRegionalNumber(
          ratingSum / ratedCount,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          regionalPreference
        )
      : "N/A";
  const avgUserRating =
    userRatedCount > 0
      ? formatRegionalNumber(
          userRatingSum / userRatedCount,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          regionalPreference
        )
      : "N/A";

  const getTopItemFromCounts = (counts: Record<string, number>) => {
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    const collator = getInterfaceCollator(interfaceLanguage);
    entries.sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
    const [name, count] = entries[0]!;
    return { name, count };
  };

  const topGenre = getTopItemFromCounts(genreCounts);
  const topPlatform = getTopItemFromCounts(platformCounts);
  const topPublisher = getTopItemFromCounts(publisherCounts);

  const avgReleaseYear = yearCount > 0 ? Math.round(yearSum / yearCount) : "N/A";
  const metadataHealth = Math.round((completeGamesCount / totalGames) * 100);

  // Completion Rate: % of acquired games (owned + playing + shelved + completed) that are completed
  const acquiredCount =
    statusBreakdown.owned +
    statusBreakdown.playing +
    statusBreakdown.shelved +
    statusBreakdown.completed;
  const completionRate =
    acquiredCount > 0 ? Math.round((statusBreakdown.completed / acquiredCount) * 100) : 0;

  return {
    totalGames,
    uniqueGenres: uniqueGenres.size,
    uniquePlatforms: uniquePlatforms.size,
    avgRating,
    avgUserRating,
    topGenre,
    topPlatform,
    topPublisher,
    uniqueDevelopers: uniqueDevelopers.size,
    avgReleaseYear,
    metadataHealth,
    statusBreakdown,
    completionRate,
  };
}
