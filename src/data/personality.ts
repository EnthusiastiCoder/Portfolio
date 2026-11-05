/**
 * The green mode: the person behind the products. Interests at the level of a
 * category only. Rules: no song, film, artist, player or creator names, no
 * lists of specifics, and never where any of it came from.
 */

export interface InterestCard {
  id: "music" | "chess" | "games" | "ai";
  title: string;
  /** One human line that sums it up. */
  lede: string;
  points: string[];
}

export const personalityIntro =
  "No pill, so you get me: the music on repeat, the chess I can't stop watching and the games I keep going back to.";

export const interests: InterestCard[] = [
  {
    id: "music",
    title: "Music",
    lede: "I play the flute, and listen to old songs, new songs and a lot of soundtracks.",
    points: ["Bollywood, old and new", "Bengali music", "Game soundtracks", "Phonk"],
  },
  {
    id: "chess",
    title: "Chess",
    lede: "I'd rather watch a sacrifice than a draw.",
    points: ["Attacking chess over safe chess", "Gambits, sacrifices and brilliant moves"],
  },
  {
    id: "games",
    title: "Games",
    lede: "Worlds with a story, and systems that surprise.",
    points: ["Genshin Impact, for the lore", "Simulation games and evolution sims"],
  },
  {
    id: "ai",
    title: "AI and LLMs",
    lede: "The tools I build with are also what I read about for fun.",
    points: ["Running models locally", "LLM tooling and coding agents"],
  },
];

export const alsoMe =
  "Animated films, cartoons I grew up with, festivals back home, cat memes and DIY builds.";
