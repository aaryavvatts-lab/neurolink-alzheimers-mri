import raw from "@/data/results.json";
import type { Results } from "./types";

/**
 * The results are imported at build time rather than fetched.
 *
 * Fetching them in an effect left every content page as an empty shell in the
 * exported HTML: nothing for a search engine to read, and nothing at all for a
 * visitor without JavaScript. Importing means the numbers and the prose are in
 * the file that gets served.
 *
 * The imported copy has three unused fields stripped, which is most of its
 * weight. The complete file is still served at /results.json for anyone who
 * wants the raw numbers.
 */
export const results = raw as unknown as Results;
