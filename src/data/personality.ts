/**
 * The green mode: the person behind the products. Interests only. Rules: never
 * name a video channel or creator, never mention where the data came from.
 */

export interface Track {
  title: string;
  /** Artist, film or game, as listeners know it. */
  from: string;
}

export interface InterestCard {
  id: "music" | "chess" | "games" | "ai";
  title: string;
  /** One human line that sums it up. */
  lede: string;
  points: string[];
}

export const personalityIntro =
  "No pill, so you get me: the music on repeat, the chess I can't stop watching and the games I keep going back to.";

export const nowPlaying: Track[] = [
  { title: "Life is Inexhaustible", from: "Genshin Impact soundtrack" },
  { title: "Maine Tujhko Dekha", from: "Golmaal Again" },
  { title: "Nod-Krai theme, flute cover", from: "Genshin Impact" },
  { title: "Dil Mein Ho Tum", from: "Why Cheat India" },
  { title: "Sohena Jatona", from: "Arfin Rumey" },
  { title: "Toota Jo Kabhi Taara, acoustic", from: "A Flying Jatt" },
  { title: "Abhi Na Jao Chhod Kar", from: "Mohammed Rafi and Asha Bhosle, 1961" },
  { title: "Rabba", from: "Mohit Chauhan, Heropanti" },
];

export const interests: InterestCard[] = [
  {
    id: "music",
    title: "Music",
    lede: "Rafi to Arijit, with a detour through Teyvat.",
    points: [
      "Bollywood, the classics and the new stuff",
      "Bengali songs and Rabindra Sangeet",
      "Game soundtracks, Genshin's most of all",
      "Phonk and slowed edits",
      "I play the flute, so flute covers get replayed a lot",
    ],
  },
  {
    id: "chess",
    title: "Chess",
    lede: "Team Tal: I'd rather watch a sacrifice than a draw.",
    points: [
      "Favourite players: Mikhail Tal, Magnus Carlsen, Hikaru Nakamura, Vishy Anand and Alireza Firouzja",
      "Openings I keep coming back to: the King's Gambit, the Albin Countergambit and the Stafford Gambit",
      "Brilliant moves, engine chaos and anything that gives up the queen",
    ],
  },
  {
    id: "games",
    title: "Games",
    lede: "Genshin for the lore, simulations for the chaos.",
    points: [
      "Genshin Impact: every Archon Quest, every lore theory, free to play with a Cryo Traveler main",
      "Simulation games: ant colonies, evolution sims and AIs that learn to hunt and hide",
    ],
  },
  {
    id: "ai",
    title: "AI and LLMs",
    lede: "The tools I build with are also the thing I read about for fun.",
    points: [
      "Running models locally and what it takes to fit them",
      "Claude Code every day, and how to get more out of it",
      "LLM tooling, agents and the research behind them",
    ],
  },
];

export const alsoMe =
  "Kung Fu Panda rewatcher, Ben 10 kid at heart, Durga Puja pandal-hopper, collector of cat memes and fan of DIY solar builds.";
