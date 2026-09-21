export type {
  MovieBoxKind,
  MovieBoxItem,
  MovieBoxSection,
  MovieBoxHomeResponse,
  MovieBoxCategoryResponse,
  MovieBoxDetail,
  MovieBoxStreamSource,
  MovieBoxStreamResponse,
} from "./types";

export {
  getHome,
  getMovies,
  getTvSeries,
  getAnimation,
  search,
} from "./service";
