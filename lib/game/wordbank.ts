/**
 * Starter word bank — 6 categories, 16 secret words each (96 total).
 * `hint` is a short flavor clue kept OUT of the imposter's view; it is shown
 * on the results screen (and could power a "hint mode" later).
 */

export interface WordEntry {
  w: string;
  h: string;
}

export interface WordPack {
  key: string;
  name: string;
  emoji: string;
  blurb: string;
  words: WordEntry[];
}

export const DISCOY_COUNT = 3;

export const WORD_PACKS: WordPack[] = [
  {
    key: "objects",
    name: "Everyday Objects",
    emoji: "🪑",
    blurb: "Stuff lying around your house",
    words: [
      { w: "Umbrella", h: "Pops open the second it starts raining" },
      { w: "Mirror", h: "The only one who truly copies you" },
      { w: "Keyboard", h: "Clicks harder when you rage" },
      { w: "Toaster", h: "The original fire hazard" },
      { w: "Pillow", h: "Professional face catcher" },
      { w: "Ladder", h: "Step two always wobbles" },
      { w: "Scissors", h: "Runs on left or right-handed privilege" },
      { w: "Backpack", h: "Carries your whole life at half the zips" },
      { w: "Kettle", h: "Screams when it finishes thinking" },
      { w: "Sunglasses", h: "Cool in summer, invisible in every winter" },
      { w: "Paperclip", h: "Holds the office together, literally" },
      { w: "Headphones", h: "Knots itself while it sleeps in your pocket" },
      { w: "Wallet", h: "Gets thinner every Friday night" },
      { w: "Magnet", h: "Fridge's best friend" },
      { w: "Candle", h: "Dies a little to light up the vibe" },
      { w: "Doorbell", h: "Always rung by someone who can't wait" },
    ],
  },
  {
    key: "pop",
    name: "Pop Culture",
    emoji: "🎤",
    blurb: "Netflix, TikTok & platinum records",
    words: [
      { w: "Fortnite", h: "Dance like no one is spectating" },
      { w: "Taylor Swift", h: "Writes an album every breakup" },
      { w: "Minecraft", h: "Punch trees, fear the night" },
      { w: "Marvel", h: "Everything connects if you wait 6 years" },
      { w: "Harry Potter", h: "A boy who lived, rent-free in our heads" },
      { w: "Star Wars", h: "The sequel trilogy of family drama" },
      { w: "BTS", h: "The army marches behind them" },
      { w: "TikTok", h: "5 minutes scrolling, 5 hours lost" },
      { w: "Stranger Things", h: "The upside down of '80s nostalgia" },
      { w: "Pokemon", h: "Gotta catch absolutely all of them" },
      { w: "Beyonce", h: "If you liked it, you should have put a ring on it" },
      { w: "SpongeBob", h: "Lives in a pineapple, works at a fast food job" },
      { w: "Squid Game", h: "Red light. Green light. Trust no one" },
      { w: "Barbie", h: "Life in plastic, it's fantastic" },
      { w: "Spider-Man", h: "Bitten by greatness, allergic to responsibility" },
      { w: "The Office", h: "That's what she said" },
    ],
  },
  {
    key: "food",
    name: "Food & Drink",
    emoji: "🍔",
    blurb: "Late-night cravings and comfort food",
    words: [
      { w: "McDonald's", h: "I'm lovin' the golden arches" },
      { w: "Pizza", h: "A circle you regret cutting unevenly" },
      { w: "Sushi", h: "Raw ambition, wrapped in seaweed" },
      { w: "Taco", h: "Tuesday's main character" },
      { w: "Avocado", h: "Ripe for 6 minutes, then gone forever" },
      { w: "Cotton Candy", h: "90% air, 10% sugar crash" },
      { w: "Ramen", h: "Slurp now, apologize never" },
      { w: "Popcorn", h: "The official sponsor of spoilers" },
      { w: "Smoothie", h: "A fruit salad that gave up on structure" },
      { w: "Pancakes", h: "Stacked higher than Sunday expectations" },
      { w: "Garlic Bread", h: "Universally agreed to be the best thing ever baked" },
      { w: "Ice Cream Sandwich", h: "Two cookies agree to share a freezer heart" },
      { w: "Hot Dog", h: "Sandwich? Debate ongoing since 1837" },
      { w: "Boba Tea", h: "Chew your drink, question nothing" },
      { w: "Nachos", h: "Cheese pulls longer than your group chat drama" },
      { w: "Ketchup", h: "Technically a smoothie if you commit" },
    ],
  },
  {
    key: "places",
    name: "Places & Landmarks",
    emoji: "🗿",
    blurb: "Postcards and tourist traps",
    words: [
      { w: "Eiffel Tower", h: "Paris' favorite metal influencer" },
      { w: "Beach", h: "Sand in every pocket for a week" },
      { w: "Gas Station", h: "Home of questionable hot dogs and brighter lights" },
      { w: "Library", h: "Shhh... except for the printer" },
      { w: "Airport", h: "Where your shoes join the unemployment line" },
      { w: "Grand Canyon", h: "Nature's biggest 'whoa'" },
      { w: "Statue of Liberty", h: "Tallest friend at the harbor, always holding a torch" },
      { w: "Golden Gate Bridge", h: "Painted forever, fog included" },
      { w: "Antarctica", h: "The only continent with no group chat drama" },
      { w: "Disneyland", h: "Happiest wallet drain on Earth" },
      { w: "Las Vegas", h: "What happens here gets bragged about anyway" },
      { w: "Hospital", h: "Waiting rooms that wait harder than you" },
      { w: "Great Wall of China", h: "The longest 'do not disturb' sign" },
      { w: "Niagara Falls", h: "Water with a microphone and standing crowd" },
      { w: "Parking Lot", h: "Where your car witnesses everything" },
      { w: "Space Station", h: "Highest rent, zero gravity, small view" },
      { w: "Empire State Building", h: "King Kong's favorite climbing frame" },
      { w: "Sahara Desert", h: "The largest bed of sand you'll never nap on" },
    ],
  },
  {
    key: "animals",
    name: "Animals",
    emoji: "🦩",
    blurb: "Nature's weirdest roommates",
    words: [
      { w: "Penguin", h: "Walks like it forgot pants exist" },
      { w: "Octopus", h: "Three hearts, zero commitment issues" },
      { w: "Flamingo", h: "Stands on one leg for attention" },
      { w: "Sloth", h: "Has never once been early" },
      { w: "Kangaroo", h: "Comes with built-in baby storage" },
      { w: "Peacock", h: "Opens a fan, expects applause" },
      { w: "Chameleon", h: "Blend in — this is your spirit animal" },
      { w: "Tarantula", h: "Eight legs, all legs, terror" },
      { w: "Dolphin", h: "Smiles even when it's up to no good" },
      { w: "Hedgehog", h: "Hugs require a permit" },
      { w: "Bald Eagle", h: "Screams like a microphone in a windstorm" },
      { w: "Panda", h: "Eats bamboo, skips cardio, national hero" },
      { w: "Mosquito", h: "The world's smallest, most personal dancer" },
      { w: "Gorilla", h: "Chest drum louder than any doorbell" },
      { w: "Jellyfish", h: "No brain, still runs the ocean" },
      { w: "T-Rex", h: "Arms too short, claps impossible" },
    ],
  },
  {
    key: "jobs",
    name: "Jobs & Hobbies",
    emoji: "🎸",
    blurb: "Dream jobs and weekend obsessions",
    words: [
      { w: "Firefighter", h: "Walks into the part everyone runs from" },
      { w: "Astronaut", h: "Commutes 400km straight up" },
      { w: "Barista", h: "Spells your name wrong with total confidence" },
      { w: "DJ", h: "Reads the room, controls the legs" },
      { w: "Magician", h: "Nothing up their sleeves, except everything" },
      { w: "Lifeguard", h: "Professional whistle owner" },
      { w: "Knitting", h: "Turning yarn into sweater weather" },
      { w: "Karaoke", h: "Vocal chords optional, confidence mandatory" },
      { w: "Skateboarding", h: "Gravity denial as a lifestyle" },
      { w: "Chess", h: "Four moves deep, already losing" },
      { w: "Plumber", h: "The hero your 2am flood deserves" },
      { w: "Surgeon", h: "Also plays Operation competitively" },
      { w: "Detective", h: "Trusts no one — sound familiar?" },
      { w: "YouTube", h: "Do it for the algorithm, not the monetization" },
      { w: "Pottery", h: "Wheels of misfortune, beautiful results" },
      { w: "Fishing", h: "The art of sitting quietly and calling it patience" },
    ],
  },
];

export const PACK_BY_KEY: Record<string, WordPack> = Object.fromEntries(
  WORD_PACKS.map((p) => [p.key, p]),
);

export function packKeys(): string[] {
  return WORD_PACKS.map((p) => p.key);
}

export function pickPack(key: string | null | undefined): WordPack {
  if (!key || key === "random") {
    return WORD_PACKS[Math.floor(Math.random() * WORD_PACKS.length)];
  }
  return PACK_BY_KEY[key] ?? WORD_PACKS[0];
}

/** Result of a deal: the secret for the round plus decoys for the imposter's steal UI. */
export interface Deal {
  pack: WordPack;
  word: WordEntry;
  decoys: string[];
}

export function dealWord(packKey: string): Deal {
  const pack = pickPack(packKey);
  const idx = Math.floor(Math.random() * pack.words.length);
  const word = pack.words[idx];
  const decoys = pack.words
    .filter((_, i) => i !== idx)
    .sort(() => Math.random() - 0.5)
    .slice(0, DISCOY_COUNT)
    .map((d) => d.w);
  return { pack, word, decoys };
}
