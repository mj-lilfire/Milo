/**
 * The route.
 *
 * Every island is pure data: terrain shape, palette, what grows there, who
 * lives there and what they want. The generators in src/world turn this into a
 * place you can walk around, so adding an island is an entry in this file
 * rather than a modelling job.
 *
 * This is an original fan prototype. The geography and cast are affectionate
 * nods; every polygon in the game is generated from the numbers below.
 */

const TAU = Math.PI * 2;

// --- palettes ---------------------------------------------------------------

const TROPICAL = {
  sand: 0xe9dcae, wetSand: 0xc7b483, ground: 0x5a9b46, rock: 0x8b8478, high: 0x9c9488,
  leaf: 0x3d8a3d, trunk: 0x7a5330, stone: 0x9a958a, wood: 0x8a5f33,
  wall: 0xe8ddc0, roof: 0xc4553a, thatch: 0xc9a35a, accent: 0xd8a03a, seabed: 0x497a68,
};

const VERDANT = {
  ...TROPICAL, ground: 0x6faa4e, leaf: 0x4f9c46, wall: 0xf0e6cf, roof: 0x9c5a3a,
  sand: 0xe4d6a4, accent: 0xc9a227,
};

const TOWN = {
  sand: 0xd9cba6, wetSand: 0xb9a97f, ground: 0x7d9153, rock: 0x8e8a80, high: 0x9a948a,
  leaf: 0x4f8a48, trunk: 0x6b4a2a, stone: 0xa39c90, wood: 0x7a5129,
  wall: 0xdcd2bc, roof: 0x8a4a3a, thatch: 0xb89a5a, accent: 0x9a3f3f, seabed: 0x4a6f60,
};

const REEF = {
  sand: 0xe3d6b4, wetSand: 0xbfae86, ground: 0x4f8f66, rock: 0x76808a, high: 0x8a939a,
  leaf: 0x2f8a72, trunk: 0x6a4a34, stone: 0x7d8791, wood: 0x6f4d2e,
  wall: 0xc9d4d0, roof: 0x3f6f8a, thatch: 0xa89a6a, accent: 0x2f8fa8, seabed: 0x3f7a74,
};

const ROCKY = {
  sand: 0xbfb49a, wetSand: 0x9a907c, ground: 0x6d7a5c, rock: 0x7a746c, high: 0x8e8880,
  leaf: 0x3f6b46, trunk: 0x5c452e, stone: 0x857f76, wood: 0x6b4a2a,
  wall: 0xcfc6b4, roof: 0x6a4a42, thatch: 0xa8965e, accent: 0xd8703a, seabed: 0x46604f,
};

const SAVANNA = {
  sand: 0xdfcd9a, wetSand: 0xbdab7c, ground: 0x9aa155, rock: 0x9a8f76, high: 0xa89a80,
  leaf: 0x6f9a4a, trunk: 0x7a6440, stone: 0xa1957c, wood: 0x8a6a3a,
  wall: 0xe0d2ae, roof: 0xa8623a, thatch: 0xc4a866, accent: 0xc45a3a, seabed: 0x5a6e52,
};

const SNOW = {
  sand: 0xdfe7ee, wetSand: 0xbcc8d2, ground: 0xeaf2f8, rock: 0x76808c, high: 0xf6fbff,
  leaf: 0x2f5a44, trunk: 0x4a3a2c, stone: 0x8a929c, wood: 0x6a5238,
  wall: 0xdfe6ec, roof: 0x5a6b7c, thatch: 0xb0a88e, accent: 0xc84f4f, seabed: 0x3f5560,
  snow: true,
};

const DESERT = {
  sand: 0xe7cb92, wetSand: 0xc4a870, ground: 0xd9b878, rock: 0xb08b5c, high: 0xc9a877,
  leaf: 0x6f8f4a, trunk: 0x8a6a3a, stone: 0xc0a273, wood: 0x9a7442,
  wall: 0xe4cfa4, roof: 0xb9764a, thatch: 0xcfae70, accent: 0x2f7f9f, seabed: 0x6f7a5c,
};

// --- skies and water --------------------------------------------------------

const CLEAR = {
  top: 0x3a7fc4, horizon: 0xd2e6f0, sun: 0xfff2d4, haze: 0.42,
  sunIntensity: 2.15, ambientSky: 0xc2dcea, ambientGround: 0x536b4e,
};
const GOLDEN = {
  top: 0x2f6ba8, horizon: 0xf2d9a8, sun: 0xffd9a0, haze: 0.55,
  sunIntensity: 2.0, ambientSky: 0xe4cfa8, ambientGround: 0x5c5342, cloud: 0xffe8c8,
};
const GREY = {
  top: 0x6f7f90, horizon: 0xc2ccd4, sun: 0xe8e8e0, haze: 0.62,
  sunIntensity: 1.35, ambientSky: 0xb8c4ce, ambientGround: 0x4f5a52, cloud: 0xd8dee4,
};
const COLD = {
  top: 0x8ca9c4, horizon: 0xe4eef6, sun: 0xeaf2ff, haze: 0.72,
  sunIntensity: 1.5, ambientSky: 0xd6e6f2, ambientGround: 0x8a98a4, cloud: 0xeef4fa,
};
const DUSTY = {
  top: 0x4f8ec0, horizon: 0xefd7a4, sun: 0xffe0a8, haze: 0.66,
  sunIntensity: 2.4, ambientSky: 0xefd9ae, ambientGround: 0x8a7248, cloud: 0xf6e8cc,
};
const STORM = {
  top: 0x3a4a5c, horizon: 0x8a98a4, sun: 0xc8d0d8, haze: 0.78,
  sunIntensity: 1.1, ambientSky: 0x8fa0ae, ambientGround: 0x3f4a44, cloud: 0x7a8894,
  cloudOpacity: 0.92,
};

const JUNGLE = {
  sand: 0xd9c89a, wetSand: 0xb6a477, ground: 0x3f7a38, rock: 0x7a7266, high: 0x8a8175,
  leaf: 0x2f6f33, trunk: 0x5e4328, stone: 0x8a8278, wood: 0x6f4a28,
  wall: 0xcfc0a0, roof: 0x7a4535, thatch: 0xb2934f, accent: 0xc46a2f, seabed: 0x3f6a58,
};

const SKY_ISLE = {
  sand: 0xf2f6f8, wetSand: 0xdfe7ec, ground: 0x7ec46a, rock: 0xe4e8ea, high: 0xfaFDFF,
  leaf: 0x5fae52, trunk: 0x9a8a6a, stone: 0xeef2f4, wood: 0xcfc2a2,
  wall: 0xf4f6f2, roof: 0xd8b84a, thatch: 0xe0cf8a, accent: 0xe8c84a, seabed: 0xdfe7ec,
};

const CANAL = {
  sand: 0xcfc2a4, wetSand: 0xa89b80, ground: 0x8a9a6a, rock: 0x9a958c, high: 0xa8a29a,
  leaf: 0x4f8a48, trunk: 0x6b4a2a, stone: 0xbdb4a4, wood: 0x8a5f33,
  wall: 0xe4d8c0, roof: 0xb4633c, thatch: 0xc0a468, accent: 0x2f7f9f, seabed: 0x46707a,
};

const HAUNTED = {
  sand: 0x7e7e84, wetSand: 0x5f5f66, ground: 0x585a62, rock: 0x6a6a74, high: 0x7e7e88,
  leaf: 0x3d4a42, trunk: 0x4a423c, stone: 0x86868f, wood: 0x554c44,
  wall: 0x6e6878, roof: 0x4a4454, thatch: 0x6a6478, accent: 0x9a5faa, seabed: 0x333a44,
  deadWood: 0x50483f,
};

const MANGROVE = {
  sand: 0xd8c99e, wetSand: 0xb0a07a, ground: 0x4f8a48, rock: 0x7f7a70, high: 0x8f8a80,
  leaf: 0x357f3a, trunk: 0x6a4e30, stone: 0x8f8a80, wood: 0x7a5330,
  wall: 0xd8ccb0, roof: 0x8a5a3a, thatch: 0xbfa268, accent: 0xd86a9a, seabed: 0x3f7060,
};

const RAREFIED = {
  top: 0x9fd4ef, horizon: 0xfbfdfe, sun: 0xfffbe8, haze: 0.5,
  sunIntensity: 2.5, ambientSky: 0xf4fbff, ambientGround: 0xdfe7ec, cloud: 0xffffff,
};
// Moonlight has to stay playable: atmospheric is no good if the player cannot
// see the thing walking toward them. Lifted until enemies read clearly against
// the ground, and no further.
const MOONLIT = {
  top: 0x1b2440, horizon: 0x4d5878, sun: 0xc8d4ee, haze: 0.78,
  sunIntensity: 0.95, ambientSky: 0x6a7699, ambientGround: 0x3a4050,
  ambientIntensity: 1.7, cloud: 0x6e768c, cloudOpacity: 0.9,
};

const BLUE_WATER = { deep: 0x0a3b5c, shallow: 0x2d8fae };
const CLOUD_SEA = { deep: 0xe8f1f6, shallow: 0xfdfefe, fogDensity: 0.0005 };
const BLACK_WATER = { deep: 0x080d16, shallow: 0x1c2740, fogDensity: 0.0009 };
const GREEN_WATER = { deep: 0x0c4450, shallow: 0x35a08f };
const COLD_WATER = { deep: 0x18394f, shallow: 0x5e93a8 };
const WARM_WATER = { deep: 0x0f4a6a, shallow: 0x39a7bd };

// --- helpers ----------------------------------------------------------------

const polar = (angle, dist) => ({ x: Math.sin(angle) * dist, z: Math.cos(angle) * dist });

/** A ring of buildings facing a central square. */
function ringOfHouses(hub, count, radius, prop = "house", startAngle = 0.3) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = startAngle + (i / count) * TAU;
    out.push({
      prop,
      at: { x: hub.x + Math.sin(a) * radius, z: hub.z + Math.cos(a) * radius },
      rotation: a + Math.PI,
    });
  }
  return out;
}

// --- enemy looks ------------------------------------------------------------

const MARINE = {
  shirt: 0xf0f0ec, pants: 0x24406e, skin: 0xe3b184, hairColor: 0x3a2a1c,
  accent: 0x24406e, hat: "marine", hair: "short", gear: "rifle",
};
const THUG = {
  shirt: 0xb8462f, pants: 0x3a3a46, skin: 0xdca97e, hairColor: 0x6a3a2a,
  accent: 0xd8a03a, hat: "cap", hair: "spiky", gear: "none",
};
const FISHMAN = {
  shirt: 0x2f7f8f, pants: 0x1f4a5a, skin: 0x6fb4b8, hairColor: 0x2a5a6a,
  accent: 0x9fd8cf, hat: "none", hair: "spiky", gear: "none", scale: 1.16,
};
const HUNTER = {
  shirt: 0x2a2a34, pants: 0x1f1f28, skin: 0xd8a87e, hairColor: 0x1a1a1a,
  accent: 0x8a6a3a, hat: "tricorn", hair: "short", gear: "swords",
};
const BULLY = {
  shirt: 0xc46a2f, pants: 0x3a3a44, skin: 0xd8a87e, hairColor: 0xe0c04a,
  accent: 0x8a3f2f, hat: "none", hair: "spiky", gear: "none",
};
const PRIEST = {
  shirt: 0xf2f4f0, pants: 0xe0d8c0, skin: 0xd8a87e, hairColor: 0xb8a878,
  accent: 0xe8c84a, hat: "none", hair: "long", gear: "staff", scale: 1.08,
};
const WRECKER = {
  shirt: 0x3a3a42, pants: 0x24242c, skin: 0xc99a6a, hairColor: 0x1a1a1a,
  accent: 0x8a8a92, hat: "cap", hair: "short", gear: "none", scale: 1.06,
};
const REVENANT = {
  shirt: 0x4a4452, pants: 0x2f2a36, skin: 0x8fa38a, hairColor: 0x2a2a30,
  accent: 0x6a4f7a, hat: "none", hair: "long", gear: "none",
};
const SLAVER = {
  shirt: 0x2a2a34, pants: 0x1a1a22, skin: 0xd8a87e, hairColor: 0x3a3a3a,
  accent: 0x9a7f4a, hat: "top", hair: "short", gear: "rifle", scale: 1.05,
};
const AGENT = {
  shirt: 0xc9a86a, pants: 0x6a5a3a, skin: 0xc99a6a, hairColor: 0x2a1d12,
  accent: 0x2f7f9f, hat: "cap", hair: "short", gear: "none",
};

// ============================================================================
// 1 — Foosha Village
// ============================================================================

const foosha = (() => {
  const hub = polar(2.4, 52);
  const headland = polar(5.2, 86);
  return {
    id: "foosha",
    name: "Foosha Village",
    sea: "East Blue",
    blurb: "A windmill town where every voyage starts.",
    tagline: "where it all starts",
    world: { x: 0, z: 0 },
    climate: "tropical",
    dockAngle: 0.5,
    ambience: "shore",
    palette: TROPICAL,
    landSky: { ...CLEAR, fogDensity: 0.0013 },
    seaSky: CLEAR,
    seaWater: BLUE_WATER,
    landWater: BLUE_WATER,
    terrain: {
      radius: 132, baseHeight: 3.0, relief: 5.5, noiseScale: 58, shelfDepth: 15,
      peaks: [{ x: -40, z: -52, height: 26, radius: 54 }],
      flats: [
        { x: hub.x, z: hub.z, r: 38, height: 5.2 },
        { x: headland.x, z: headland.z, r: 16, height: 7.0 },
      ],
    },
    places: {
      tavern: { x: hub.x, z: hub.z + 4 },
      square: { x: hub.x, z: hub.z },
      headland: { x: headland.x, z: headland.z },
      hill: { x: -40, z: -52 },
    },
    scatter: [
      { prop: "palm", count: 46, band: { minH: 1.4, maxH: 20, maxSlope: 0.4 }, spacing: 5, scale: [0.85, 1.25] },
      { prop: "broadleaf", count: 22, band: { minH: 4, maxH: 26, maxSlope: 0.45 }, spacing: 6 },
      { prop: "rock", count: 26, band: { minH: 0.6, maxSlope: 0.8 }, spacing: 3 },
      { prop: "grassTuft", count: 120, band: { minH: 1.6, maxSlope: 0.5 }, spacing: 1.2 },
      { prop: "fence", count: 10, band: { minH: 4, maxH: 12, maxSlope: 0.2 }, spacing: 8 },
    ],
    structures: [
      ...ringOfHouses(hub, 7, 26),
      { prop: "windmill", at: { x: hub.x - 6, z: hub.z - 34 } },
      { prop: "windmill", at: { x: hub.x + 22, z: hub.z - 30 }, scale: 0.85 },
      { prop: "signpost", at: { x: hub.x + 2, z: hub.z + 16 } },
      { prop: "barrel", at: { x: hub.x - 8, z: hub.z + 9 } },
      { prop: "barrel", at: { x: hub.x - 9.4, z: hub.z + 10.5 } },
      { prop: "crate", at: { x: hub.x + 9, z: hub.z + 8 } },
      { prop: "flagpole", at: { x: hub.x, z: hub.z - 10 } },
    ],
    chests: [
      {
        at: { x: headland.x, z: headland.z }, berries: 450, item: "Crate of provisions",
        flag: "foosha_provisions", advancesStep: 1,
      },
    ],
    npcs: [
      {
        id: "makino", name: "Makino", role: "Innkeeper",
        at: { x: hub.x + 1, z: hub.z + 7 },
        look: {
          shirt: 0xe8e0cc, pants: 0x4a6f5a, skin: 0xefc09a, hairColor: 0x2f2a24,
          accent: 0x9a6a3a, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "So today's the day. You've only been saying it since you could walk.",
              "The ship's provisioned except for one crate — I left it out on the headland to keep it cool.",
              "Fetch it back and she's yours. Then the sea is your problem, not mine.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["East side, past the palms. You can't miss a crate that size."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "That's the lot. Salt pork, ship's biscuit, and something sweet I'm not admitting to.",
              "Follow the Log Pose and don't look back at the village. It only makes it harder.",
              "Go on, Captain.",
            ],
            effects: { completeIsland: true, berries: 300 },
          },
          {
            lines: ["The tavern's always open when you come back through.", "Mind the reef on the way out."],
          },
        ],
      },
      {
        id: "woodsman", name: "Gorou", role: "Woodcutter",
        at: { angle: 4.1, dist: 0.55 },
        look: {
          shirt: 0x8a5f33, pants: 0x4a4a3a, skin: 0xc99a6a, hairColor: 0x4a3a2a,
          accent: 0x6a4a2a, hat: "cap", hair: "short",
        },
        talks: [
          {
            lines: [
              "Heading out on that little boat? Brave. Or the other thing.",
              "The Grand Line eats ships like that for breakfast. You'll want a crew.",
              "Start with someone who can fight, then someone who can read a chart. In that order.",
            ],
          },
        ],
      },
    ],
    quest: {
      title: "Setting Out",
      steps: [
        { objective: "Find Makino at the village tavern.", marker: "tavern" },
        { objective: "Fetch the crate of provisions from the headland.", marker: "headland" },
        { objective: "Bring the provisions back to Makino.", marker: "tavern" },
      ],
    },
  };
})();

// ============================================================================
// 2 — Shells Town
// ============================================================================

const shells = (() => {
  const hub = polar(1.1, 46);
  const base = polar(4.4, 62);
  return {
    id: "shells",
    name: "Shells Town",
    sea: "East Blue",
    blurb: "A Marine garrison with something tied up in its yard.",
    tagline: "the marine base",
    world: { x: 640, z: -390 },
    climate: "town",
    dockAngle: 1.0,
    ambience: "shore",
    palette: TOWN,
    landSky: { ...CLEAR, fogDensity: 0.0014 },
    seaSky: CLEAR,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 142, baseHeight: 3.4, relief: 4.2, noiseScale: 52, shelfDepth: 16,
      peaks: [{ x: 46, z: 40, height: 18, radius: 46 }],
      flats: [
        { x: hub.x, z: hub.z, r: 40, height: 5.5 },
        { x: base.x, z: base.z, r: 44, height: 8.5 },
      ],
    },
    places: {
      square: { x: hub.x, z: hub.z },
      base: { x: base.x, z: base.z },
      post: { x: base.x + 12, z: base.z + 12 },
    },
    scatter: [
      { prop: "broadleaf", count: 30, band: { minH: 2, maxSlope: 0.4 }, spacing: 6 },
      { prop: "palm", count: 14, band: { minH: 1.4, maxH: 8, maxSlope: 0.35 }, spacing: 6 },
      { prop: "rock", count: 22, band: { minH: 0.6, maxSlope: 0.9 }, spacing: 3 },
      { prop: "grassTuft", count: 110, band: { minH: 1.8, maxSlope: 0.5 }, spacing: 1.3 },
      { prop: "lamppost", count: 10, band: { minH: 4, maxH: 12, maxSlope: 0.16 }, spacing: 10 },
    ],
    structures: [
      ...ringOfHouses(hub, 9, 29),
      { prop: "watchtower", at: { x: base.x, z: base.z }, scale: 1.5 },
      { prop: "watchtower", at: { x: base.x - 22, z: base.z - 14 } },
      { prop: "cannon", at: { x: base.x + 9, z: base.z + 18 }, rotation: 0.4 },
      { prop: "cannon", at: { x: base.x - 9, z: base.z + 19 }, rotation: -0.4 },
      { prop: "flagpole", at: { x: base.x + 12, z: base.z + 12 } },
      { prop: "fence", at: { x: base.x + 18, z: base.z + 6 }, rotation: 1.3 },
      { prop: "fence", at: { x: base.x + 18, z: base.z - 0.5 }, rotation: 1.3 },
      { prop: "crate", at: { x: hub.x + 11, z: hub.z - 6 } },
      { prop: "barrel", at: { x: hub.x - 12, z: hub.z + 4 } },
      { prop: "signpost", at: { x: hub.x + 3, z: hub.z + 18 } },
    ],
    chests: [
      { at: { angle: 5.6, dist: 0.72 }, berries: 600, flag: "shells_chest" },
    ],
    enemies: [
      {
        id: "yard",
        when: { minStep: 1, maxStep: 1 },
        around: { x: base.x, z: base.z + 14 },
        radius: 20,
        count: 4,
        rewardEach: 120,
        clearAdvancesStep: 1,
        foe: {
          name: "Marine", title: "garrison", hp: 58, damage: 8, speed: 3.2,
          aggroRange: 20, look: MARINE,
        },
      },
    ],
    npcs: [
      {
        id: "rika", name: "Rika", role: "Local",
        at: { x: hub.x - 4, z: hub.z + 8 },
        look: {
          shirt: 0xe0a8b8, pants: 0x4a5a7a, skin: 0xefc09a, hairColor: 0x3a2a1c,
          accent: 0xd85a7a, hat: "none", hair: "short", scale: 0.72,
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "You're not a Marine. Good.",
              "There's a man tied to a post in their yard. Nineteen days now. He hasn't asked for anything.",
              "They say he's a demon. I brought him a rice ball and he said thank you, so I don't believe them.",
              "The gate's guarded. I can't get past, but maybe you can.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["The yard's on the high ground, north side. Please hurry."],
          },
          {
            when: { minStep: 2 },
            lines: ["You actually did it. Take care of him — he won't ask you to."],
          },
        ],
      },
      {
        id: "zoro_post", name: "Zoro", role: "Prisoner",
        at: { x: base.x + 12, z: base.z + 13.5 },
        facing: 0.6,
        when: { lacksCrew: "swordsman" },
        look: {
          shirt: 0x2f6f4a, pants: 0x22272e, skin: 0xe3b184, hairColor: 0x4f7a3a,
          accent: 0x2f7f4f, hat: "bandana", hair: "short",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "Don't bother. Walk on.",
              "…Unless you're planning to do something about the four of them behind you. Then stay.",
            ],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Nineteen days on this post and you're the first one to cut the rope instead of gawping.",
              "So. You're a pirate. I hunt pirates.",
              "But I made a promise to someone once, and I can't keep it tied to a fence.",
            ],
            choices: [
              {
                label: "\"Join my crew. I'm going to the Grand Line.\"",
                lines: [
                  "The Grand Line. Of course you are.",
                  "Fine. My swords are yours until I'm the greatest swordsman alive. Then we'll talk.",
                  "Don't get us killed before that.",
                ],
                effects: { recruit: "swordsman", completeIsland: true, berries: 250 },
              },
              {
                label: "\"Just passing through.\"",
                lines: ["Then untie the rope and go. I've got a promise to keep either way."],
              },
            ],
          },
        ],
      },
      {
        id: "smith", name: "Ippon", role: "Smith",
        at: { x: hub.x + 14, z: hub.z + 10 },
        look: {
          shirt: 0x6a4a3a, pants: 0x3a3a44, skin: 0xc98a5a, hairColor: 0x2a2a2a,
          accent: 0x8a6a3a, hat: "cap", hair: "short",
        },
        talks: [
          {
            lines: [
              "Blades? I sharpen, I don't sell. Not to strangers.",
              "The garrison took my best three and never paid. That's the Marines for you.",
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Man on the Post",
      steps: [
        { objective: "Find out what the locals are afraid to say. Ask around the square.", marker: "square" },
        { objective: "Clear the Marines from the garrison yard.", marker: "base" },
        { objective: "Speak to the prisoner tied to the post.", marker: "post" },
      ],
    },
  };
})();

// ============================================================================
// 3 — Orange Town
// ============================================================================

const orange = (() => {
  const hub = polar(0.2, 40);
  const bigtop = polar(3.5, 58);
  return {
    id: "orange",
    name: "Orange Town",
    sea: "East Blue",
    blurb: "Emptied by a circus crew with cannons and a grudge.",
    tagline: "the ransacked town",
    world: { x: 1280, z: -780 },
    climate: "town",
    dockAngle: 0.0,
    ambience: "shore",
    palette: { ...TOWN, roof: 0xb05a2a, accent: 0xd85a3a },
    landSky: { ...GOLDEN, fogDensity: 0.0016 },
    seaSky: GOLDEN,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 134, baseHeight: 3.2, relief: 4.8, noiseScale: 48, shelfDepth: 15,
      peaks: [{ x: -52, z: 30, height: 22, radius: 40 }],
      flats: [
        { x: hub.x, z: hub.z, r: 42, height: 4.8 },
        { x: bigtop.x, z: bigtop.z, r: 30, height: 7.5 },
      ],
    },
    places: {
      square: { x: hub.x, z: hub.z },
      bigtop: { x: bigtop.x, z: bigtop.z },
      rooftop: { x: hub.x - 20, z: hub.z - 18 },
    },
    scatter: [
      { prop: "broadleaf", count: 20, band: { minH: 2, maxSlope: 0.4 }, spacing: 7 },
      { prop: "rock", count: 26, band: { minH: 0.6, maxSlope: 0.9 }, spacing: 3 },
      { prop: "crate", count: 26, band: { minH: 2, maxH: 12, maxSlope: 0.3 }, spacing: 2.4 },
      { prop: "barrel", count: 20, band: { minH: 2, maxH: 12, maxSlope: 0.3 }, spacing: 2.4 },
      { prop: "grassTuft", count: 80, band: { minH: 1.8, maxSlope: 0.5 }, spacing: 1.4 },
    ],
    structures: [
      ...ringOfHouses(hub, 11, 30),
      ...ringOfHouses(hub, 6, 52, "house", 0.9),
      { prop: "tent", at: { x: bigtop.x, z: bigtop.z }, scale: 2.4 },
      { prop: "tent", at: { x: bigtop.x + 14, z: bigtop.z - 8 }, scale: 1.2 },
      { prop: "tent", at: { x: bigtop.x - 15, z: bigtop.z - 6 }, scale: 1.2 },
      { prop: "cannon", at: { x: bigtop.x + 5, z: bigtop.z + 16 }, rotation: 0.1 },
      { prop: "lamppost", at: { x: hub.x + 8, z: hub.z + 14 } },
      { prop: "signpost", at: { x: hub.x - 6, z: hub.z + 17 } },
    ],
    chests: [
      { at: { x: bigtop.x - 6, z: bigtop.z - 10 }, berries: 900, flag: "orange_loot" },
      { at: { angle: 2.2, dist: 0.8 }, berries: 400, flag: "orange_chest2" },
    ],
    enemies: [
      {
        id: "circus",
        when: { minStep: 1, maxStep: 1 },
        around: { x: bigtop.x, z: bigtop.z },
        radius: 22,
        count: 5,
        rewardEach: 140,
        boss: {
          id: "buggy", name: "Buggy", title: "the Clown", hp: 210, damage: 15, speed: 3.9,
          aggroRange: 26, attackCooldown: 1.6, reward: 1500, advancesStep: 1,
          at: { x: bigtop.x, z: bigtop.z + 8 },
          look: {
            shirt: 0xd84f4f, pants: 0x2f4f8a, skin: 0xefc09a, hairColor: 0x3a6fd8,
            accent: 0xf0f0f0, hat: "top", hair: "spiky", gear: "swords", scale: 1.08,
          },
        },
        foe: {
          name: "Circus Hand", title: "big top", hp: 52, damage: 8, speed: 3.5,
          aggroRange: 20, look: THUG,
        },
      },
    ],
    npcs: [
      {
        id: "boodle", name: "Boodle", role: "Mayor",
        at: { x: hub.x + 5, z: hub.z + 6 },
        look: {
          shirt: 0x8a7a5a, pants: 0x4a4a52, skin: 0xd8a87e, hairColor: 0xc8c4bc,
          accent: 0x9a3f3f, hat: "cap", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Fifty years I've been mayor of this town. Fifty.",
              "A circus crew rolled in with cannons and now there's nobody left but me and the rats.",
              "I'd fight them myself. I've got a spear and a bad back and exactly one of those is useful.",
              "The big top's up on the rise. If you're going, go now, before I think better of letting you.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["The big top, on the rise. And mind the clown — he doesn't stay in one piece."],
          },
          {
            when: { minStep: 2 },
            lines: [
              "It's quiet. I'd forgotten what that sounded like.",
              "There's a girl been picking over their loot since the shooting stopped. Roofs, north side. Sharp eyes on her.",
            ],
          },
        ],
      },
      {
        id: "nami_thief", name: "Nami", role: "Thief",
        at: { x: hub.x - 20, z: hub.z - 18 },
        when: { lacksCrew: "navigator" },
        look: {
          shirt: 0xe8e3d8, pants: 0x2f4f7a, skin: 0xefc09a, hairColor: 0xe0762f,
          accent: 0xd85a3a, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "Busy. Come back when the shooting stops.",
            ],
          },
          {
            when: { minStep: 2 },
            lines: [
              "You're the one who flattened the big top. That was loud.",
              "I steal from pirates. You're a pirate. You see my difficulty.",
              "Though… you're going to the Grand Line, and nobody gets there without a navigator.",
              "I happen to be the best one in the East Blue. That's not bragging, it's a price list.",
            ],
            choices: [
              {
                label: "\"Navigate for me. Name your cut.\"",
                lines: [
                  "My cut is all of it. I'll let you keep the ship.",
                  "…Fine. Deal. But I'm keeping the books, and you're not touching the Log Pose.",
                  "Set a course. I'll tell you when you're wrong, which will be often.",
                ],
                effects: { recruit: "navigator", completeIsland: true, berries: 400 },
              },
              {
                label: "\"I sail alone.\"",
                lines: ["Then you'll sail in circles. Offer stands until the tide turns."],
              },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Empty Town",
      steps: [
        { objective: "Find whoever is left in the town square.", marker: "square" },
        { objective: "Break up the circus crew at the big top.", marker: "bigtop" },
        { objective: "Find the thief picking over the loot.", marker: "rooftop" },
      ],
    },
  };
})();

// ============================================================================
// 4 — Syrup Village
// ============================================================================

const syrup = (() => {
  const hub = polar(5.9, 44);
  const manor = polar(2.6, 72);
  const slope = polar(4.0, 60);
  // The lookout's cliff: a real headland, flattened on top so he has
  // somewhere to stand and shout at the horizon from.
  const cliff = polar(0.9, 96);
  return {
    id: "syrup",
    name: "Syrup Village",
    sea: "East Blue",
    blurb: "Sleepy, wealthy, and about to be robbed blind.",
    tagline: "the sleepy village",
    world: { x: 2010, z: -940 },
    climate: "tropical",
    dockAngle: 5.9,
    ambience: "shore",
    palette: VERDANT,
    landSky: { ...CLEAR, fogDensity: 0.0013 },
    seaSky: CLEAR,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 150, baseHeight: 3.6, relief: 6.5, noiseScale: 60, shelfDepth: 16,
      peaks: [
        { x: manor.x, z: manor.z, height: 24, radius: 52 },
        { x: cliff.x, z: cliff.z, height: 22, radius: 30 },
      ],
      flats: [
        { x: hub.x, z: hub.z, r: 36, height: 5.0 },
        { x: manor.x, z: manor.z, r: 30, height: 24.0 },
        { x: slope.x, z: slope.z, r: 26, height: 12.0 },
        { x: cliff.x, z: cliff.z, r: 18, height: 19.0 },
      ],
    },
    places: {
      village: { x: hub.x, z: hub.z },
      manor: { x: manor.x, z: manor.z },
      slope: { x: slope.x, z: slope.z },
      cliff: { x: cliff.x, z: cliff.z },
    },
    scatter: [
      { prop: "broadleaf", count: 48, band: { minH: 2, maxSlope: 0.45 }, spacing: 6, scale: [0.9, 1.4] },
      { prop: "palm", count: 18, band: { minH: 1.4, maxH: 7, maxSlope: 0.3 }, spacing: 6 },
      { prop: "rock", count: 22, band: { minH: 0.6, maxSlope: 0.9 }, spacing: 3 },
      { prop: "grassTuft", count: 160, band: { minH: 1.6, maxSlope: 0.55 }, spacing: 1.1 },
      { prop: "fence", count: 18, band: { minH: 3, maxH: 16, maxSlope: 0.18 }, spacing: 7 },
    ],
    structures: [
      ...ringOfHouses(hub, 8, 26),
      { prop: "house", at: { x: manor.x, z: manor.z }, scale: 2.1 },
      { prop: "house", at: { x: manor.x + 20, z: manor.z + 8 }, scale: 1.1 },
      { prop: "fence", at: { x: manor.x + 4, z: manor.z + 22 }, rotation: 0 },
      { prop: "fence", at: { x: manor.x - 3, z: manor.z + 22 }, rotation: 0 },
      { prop: "windmill", at: { x: hub.x + 26, z: hub.z - 20 }, scale: 0.9 },
      { prop: "signpost", at: { x: hub.x, z: hub.z + 15 } },
      { prop: "lamppost", at: { x: hub.x - 10, z: hub.z + 10 } },
    ],
    chests: [
      { at: { x: cliff.x - 8, z: cliff.z + 6 }, berries: 700, flag: "syrup_chest" },
    ],
    enemies: [
      {
        id: "bandits",
        when: { minStep: 1, maxStep: 1 },
        around: { x: slope.x, z: slope.z },
        radius: 18,
        count: 5,
        rewardEach: 150,
        clearAdvancesStep: 1,
        foe: {
          name: "Hired Blade", title: "the slope", hp: 64, damage: 10, speed: 3.8,
          aggroRange: 22, look: HUNTER,
        },
      },
    ],
    npcs: [
      {
        id: "kaya", name: "Kaya", role: "Heiress",
        at: { x: manor.x + 2, z: manor.z + 12 },
        look: {
          shirt: 0xf0e4d0, pants: 0xd8c8b0, skin: 0xefc09a, hairColor: 0xe8d06a,
          accent: 0x9fc2d8, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Visitors. We don't get many, and lately I've stopped enjoying the ones we do.",
              "My butler has been… attentive. And there are men camped on the slope below the house who answer to him.",
              "They'll come up tonight. I'd rather they didn't.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["They're on the western slope. Please be careful — they're being paid well."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "It's over, then. Thank you.",
              "There's a boy who stands on the cliff every morning shouting that pirates are coming. Everyone laughs.",
              "He was right, and nobody listened. Go and tell him so — and take the caravel in the boathouse. It was always meant to leave.",
            ],
          },
          {
            lines: ["Fair winds. Look after him — he talks a great deal and means most of it."],
          },
        ],
      },
      {
        id: "usopp_cliff", name: "Usopp", role: "Lookout",
        at: { x: cliff.x, z: cliff.z + 3 },
        when: { lacksCrew: "sniper" },
        look: {
          shirt: 0xd8b23a, pants: 0x6b4a2a, skin: 0xa97048, hairColor: 0x2a1d12,
          accent: 0xc9a227, hat: "bandana", hair: "short", gear: "slingshot",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "PIRATES! …Oh. You're pirates. That's awkward, I've been shouting about you all morning.",
              "Come back when I've thought of something braver to say.",
            ],
          },
          {
            when: { minStep: 2 },
            lines: [
              "You cleared the slope. On your own. While I was up here shouting at the sea.",
              "I tell stories about being a brave warrior. Eight thousand men, sea kings, all of it. None of it true.",
              "But I can hit a coin at two hundred paces, and I've never once missed when it mattered.",
            ],
            choices: [
              {
                label: "\"Then be my sniper. Stories optional.\"",
                lines: [
                  "Y-you want me? On an actual pirate ship? Sailing into actual danger?",
                  "…Yes. Obviously yes. I'll take the crow's nest — I can see trouble coming from up there.",
                  "Captain Usopp, sharpshooter! ...I mean. Usopp. Just Usopp. Sharpshooter.",
                ],
                effects: { recruit: "sniper", completeIsland: true, berries: 350 },
              },
              {
                label: "\"Keep watching the horizon.\"",
                lines: ["Right. Yes. Someone has to. …The offer's open, though? Just asking."],
              },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Boy Who Cried Pirates",
      steps: [
        { objective: "Call on the heiress at the manor on the hill.", marker: "manor" },
        { objective: "Drive the hired blades off the western slope.", marker: "slope" },
        { objective: "Find the lookout on the cliff.", marker: "cliff" },
      ],
    },
  };
})();

// ============================================================================
// 5 — Baratie
// ============================================================================

const baratie = (() => {
  const deck = polar(0, 0);
  return {
    id: "baratie",
    name: "Baratie",
    sea: "East Blue",
    blurb: "A restaurant that floats, staffed entirely by former pirates.",
    tagline: "the sea-going restaurant",
    world: { x: 2760, z: -1230 },
    climate: "sea",
    dockAngle: 3.0,
    ambience: "sea",
    proxyFoliage: 6,
    palette: { ...TOWN, wall: 0xe8d2a8, roof: 0xc4553a, ground: 0xb9a276, sand: 0xd8c9a0 },
    landSky: { ...GOLDEN, fogDensity: 0.0012 },
    seaSky: GOLDEN,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 96, baseHeight: 2.6, relief: 0.9, noiseScale: 40, shelfDepth: 20,
      segments: 84, proxySegments: 34,
      flats: [{ x: 0, z: 0, r: 58, height: 3.0 }],
    },
    places: {
      kitchen: { x: 0, z: -10 },
      deckside: { x: 0, z: 26 },
    },
    scatter: [
      { prop: "barrel", count: 26, band: { minH: 2, maxSlope: 0.3, maxR: 0.8 }, spacing: 2.2 },
      { prop: "crate", count: 22, band: { minH: 2, maxSlope: 0.3, maxR: 0.8 }, spacing: 2.2 },
      { prop: "coral", count: 14, band: { minH: 1.2, maxH: 2.4, maxSlope: 0.5 }, spacing: 3 },
    ],
    structures: [
      { prop: "house", at: { x: 0, z: -14 }, scale: 2.6, rotation: 0 },
      { prop: "house", at: { x: -22, z: 2 }, scale: 1.5, rotation: 1.2 },
      { prop: "house", at: { x: 22, z: 2 }, scale: 1.5, rotation: -1.2 },
      { prop: "lamppost", at: { x: -10, z: 18 } },
      { prop: "lamppost", at: { x: 10, z: 18 } },
      { prop: "flagpole", at: { x: 0, z: 22 } },
      { prop: "cannon", at: { x: -16, z: 20 }, rotation: 0.3 },
      { prop: "cannon", at: { x: 16, z: 20 }, rotation: -0.3 },
    ],
    chests: [
      { at: { x: -26, z: -18 }, berries: 550, flag: "baratie_chest" },
    ],
    enemies: [
      {
        id: "raiders",
        when: { minStep: 1, maxStep: 1 },
        around: { x: 0, z: 20 },
        radius: 16,
        count: 5,
        rewardEach: 160,
        clearAdvancesStep: 1,
        foe: {
          name: "Raider", title: "boarding party", hp: 66, damage: 11, speed: 3.7,
          aggroRange: 22, look: THUG,
        },
      },
    ],
    npcs: [
      {
        id: "zeff", name: "Zeff", role: "Head Chef",
        at: { x: 0, z: -6 },
        look: {
          shirt: 0xf2f2ee, pants: 0x2a2a32, skin: 0xd8a87e, hairColor: 0xc8c4bc,
          accent: 0xd8d0c0, hat: "chef", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "You want a table or you want trouble? On this ship they come out of the same kitchen.",
              "Boarding party's been circling since dawn. My staff are cooks. Very violent cooks, but cooks.",
              "Clear my deck and I'll feed you properly. That's a better offer than it sounds.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["They're on the foredeck. Try not to bleed on the tablecloths."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Hmph. Adequate.",
              "There's a cook of mine out on the rail. Best hands I've trained and he's wasting them on this floating box.",
              "He dreams about a sea he's never seen. Take him with you before I have to say something kind to him.",
            ],
          },
          {
            lines: ["Kitchen's always open. Don't make me regret saying that."],
          },
        ],
      },
      {
        id: "sanji_rail", name: "Sanji", role: "Cook",
        at: { x: 0, z: 24 },
        when: { lacksCrew: "cook" },
        look: {
          shirt: 0x23232e, pants: 0x1a1a22, skin: 0xefc09a, hairColor: 0xe8cf6a,
          accent: 0xd8d0c0, hat: "none", hair: "swirl",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: ["Service is suspended on account of the men with swords. Talk later."],
          },
          {
            when: { minStep: 2 },
            lines: [
              "You fought for a restaurant you'd never eaten at. That's either stupid or the good kind of stupid.",
              "I've been on this floating box since I was a boy. There's a sea out there I've only read about.",
              "Every ingredient in the world, in one ocean. I'd like to see it before I die of stew.",
            ],
            choices: [
              {
                label: "\"Cook for my crew. I'll get you to that sea.\"",
                lines: [
                  "You don't know what you're asking. I feed people properly or not at all.",
                  "Fine. I'm in. Galley's mine, and nobody touches the stove but me.",
                  "…I'll go tell the old man. He'll pretend not to care. He'll be terrible at it.",
                ],
                effects: { recruit: "cook", completeIsland: true, berries: 500 },
              },
              {
                label: "\"Maybe another time.\"",
                lines: ["Then eat something before you go. You look like a rope."],
              },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "Dinner Service",
      steps: [
        { objective: "Find the head chef inside the restaurant.", marker: "kitchen" },
        { objective: "Throw the boarding party off the foredeck.", marker: "deckside" },
        { objective: "Talk to the cook out on the rail.", marker: "deckside" },
      ],
    },
  };
})();

// ============================================================================
// 6 — Arlong Park
// ============================================================================

const arlong = (() => {
  const park = polar(3.9, 58);
  const grove = polar(0.7, 62);
  return {
    id: "arlong",
    name: "Arlong Park",
    sea: "East Blue",
    blurb: "A fortress of fish-men taxing a village to the bone.",
    tagline: "the taxed village",
    world: { x: 3420, z: -1580 },
    climate: "tropical",
    dockAngle: 1.6,
    ambience: "shore",
    palette: REEF,
    landSky: { ...GREY, fogDensity: 0.0018 },
    seaSky: GREY,
    seaWater: GREEN_WATER,
    landWater: GREEN_WATER,
    terrain: {
      radius: 146, baseHeight: 3.0, relief: 4.0, noiseScale: 50, shelfDepth: 17,
      flats: [
        { x: park.x, z: park.z, r: 40, height: 4.5 },
        { x: grove.x, z: grove.z, r: 32, height: 6.5 },
      ],
    },
    places: {
      park: { x: park.x, z: park.z },
      grove: { x: grove.x, z: grove.z },
      gate: { x: park.x, z: park.z + 26 },
    },
    scatter: [
      { prop: "broadleaf", count: 38, band: { minH: 2, maxSlope: 0.45 }, spacing: 6 },
      { prop: "palm", count: 22, band: { minH: 1.4, maxH: 8, maxSlope: 0.32 }, spacing: 5 },
      { prop: "coral", count: 22, band: { minH: 0.8, maxH: 2.6, maxSlope: 0.6 }, spacing: 3 },
      { prop: "rock", count: 30, band: { minH: 0.6, maxSlope: 0.9 }, spacing: 3 },
      { prop: "grassTuft", count: 110, band: { minH: 1.8, maxSlope: 0.5 }, spacing: 1.3 },
    ],
    structures: [
      { prop: "watchtower", at: { x: park.x, z: park.z }, scale: 2.0 },
      { prop: "watchtower", at: { x: park.x - 24, z: park.z - 10 }, scale: 1.3 },
      { prop: "watchtower", at: { x: park.x + 24, z: park.z - 10 }, scale: 1.3 },
      { prop: "fence", at: { x: park.x - 6, z: park.z + 25 }, rotation: 1.57 },
      { prop: "fence", at: { x: park.x + 6, z: park.z + 25 }, rotation: 1.57 },
      { prop: "cannon", at: { x: park.x - 14, z: park.z + 18 }, rotation: 0.2 },
      ...ringOfHouses(grove, 6, 24, "hut"),
      { prop: "signpost", at: { x: grove.x, z: grove.z + 15 } },
    ],
    chests: [
      { at: { x: park.x - 12, z: park.z - 16 }, berries: 1200, flag: "arlong_vault" },
    ],
    enemies: [
      {
        id: "fishmen",
        when: { minStep: 1, maxStep: 2 },
        around: { x: park.x, z: park.z + 12 },
        radius: 22,
        count: 6,
        rewardEach: 200,
        clearAdvancesStep: 1,
        boss: {
          id: "arlong", name: "Arlong", title: "of the Park", hp: 320, damage: 20, speed: 4.2,
          aggroRange: 30, attackCooldown: 1.7, reward: 3000, advancesStep: 2,
          at: { x: park.x, z: park.z - 6 },
          look: {
            shirt: 0x2f6f8a, pants: 0x1f3f52, skin: 0x5fa8b8, hairColor: 0x1f4a5a,
            accent: 0xd8d0c0, hat: "none", hair: "spiky", gear: "swords", scale: 1.3,
          },
        },
        foe: {
          name: "Fish-Man", title: "the park", hp: 84, damage: 13, speed: 3.9,
          aggroRange: 24, look: FISHMAN,
        },
      },
    ],
    npcs: [
      {
        id: "nojiko", name: "Nojiko", role: "Farmer",
        at: { x: grove.x + 4, z: grove.z + 9 },
        look: {
          shirt: 0x7ec4c0, pants: 0x4a5a6a, skin: 0xd8a87e, hairColor: 0x6a9fd8,
          accent: 0xd85a7a, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Don't. Whatever you're about to offer — don't.",
              "Every year they take everything but the seed. Every year someone brave tries something, and every year we bury them.",
              "There's a girl who's been stealing for eight years to buy this village back. She's nearly there.",
              "If you break it now, you break her too. …And yet you're still standing here.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["The gate's south. If you're really doing this, don't stop halfway."],
          },
          {
            when: { questStep: 2 },
            lines: ["Their captain's still in there. He's the whole reason any of it held together."],
          },
          {
            when: { questStep: 3 },
            lines: [
              "It's quiet. The whole village is standing outside their doors not knowing what to do with themselves.",
              "Eight years of tax money, and she never has to steal another Berry.",
              "Go on. She's already on your ship, isn't she. She'd never say thank you where anyone could hear.",
            ],
            effects: { completeIsland: true, berries: 800 },
          },
          {
            lines: ["The orchards will come back. Slower than the anger, but they'll come back."],
          },
        ],
      },
      {
        id: "villager_a", name: "Genzo", role: "Constable",
        at: { x: grove.x - 12, z: grove.z + 4 },
        look: {
          shirt: 0x8a8a7a, pants: 0x3a4a52, skin: 0xc99a6a, hairColor: 0x8a8880,
          accent: 0x6a6a5a, hat: "cap", hair: "short", gear: "rifle",
        },
        talks: [
          { lines: ["One rifle. Forty rounds. Eight years of doing nothing with them.", "Say the word and that changes."] },
        ],
      },
    ],
    quest: {
      title: "Eight Years of Tax",
      steps: [
        { objective: "Speak to the farmer in the orange grove.", marker: "grove" },
        { objective: "Break through the gate and clear the park.", marker: "gate" },
        { objective: "Defeat the captain of the park.", marker: "park" },
        { objective: "Bring the news back to the grove.", marker: "grove" },
      ],
    },
  };
})();

// ============================================================================
// 7 — Loguetown
// ============================================================================

const logue = (() => {
  const hub = polar(2.0, 42);
  const platform = polar(5.0, 66);
  const harbour = polar(0.35, 78);
  return {
    id: "logue",
    name: "Loguetown",
    sea: "East Blue",
    blurb: "The last port before the Grand Line. The town of beginnings and endings.",
    tagline: "the last port",
    world: { x: 4160, z: -1760 },
    climate: "town",
    dockAngle: 0.35,
    ambience: "shore",
    palette: { ...TOWN, wall: 0xd0c4ac, roof: 0x7a4a44 },
    landSky: { ...GREY, fogDensity: 0.0017 },
    seaSky: GREY,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 158, baseHeight: 3.8, relief: 4.4, noiseScale: 54, shelfDepth: 17,
      flats: [
        { x: hub.x, z: hub.z, r: 46, height: 5.5 },
        { x: platform.x, z: platform.z, r: 30, height: 9.0 },
        { x: harbour.x, z: harbour.z, r: 26, height: 3.2 },
      ],
    },
    places: {
      square: { x: hub.x, z: hub.z },
      platform: { x: platform.x, z: platform.z },
      harbour: { x: harbour.x, z: harbour.z },
    },
    scatter: [
      { prop: "broadleaf", count: 22, band: { minH: 2, maxSlope: 0.4 }, spacing: 7 },
      { prop: "lamppost", count: 18, band: { minH: 3.5, maxH: 12, maxSlope: 0.16 }, spacing: 9 },
      { prop: "crate", count: 28, band: { minH: 2.4, maxH: 10, maxSlope: 0.3 }, spacing: 2.4 },
      { prop: "barrel", count: 24, band: { minH: 2.4, maxH: 10, maxSlope: 0.3 }, spacing: 2.4 },
      { prop: "grassTuft", count: 60, band: { minH: 2, maxSlope: 0.5 }, spacing: 1.6 },
      { prop: "rock", count: 16, band: { minH: 0.6, maxSlope: 0.9 }, spacing: 3 },
    ],
    structures: [
      ...ringOfHouses(hub, 12, 30),
      ...ringOfHouses(hub, 9, 54, "house", 1.1),
      { prop: "watchtower", at: { x: platform.x, z: platform.z }, scale: 1.8 },
      { prop: "flagpole", at: { x: platform.x + 14, z: platform.z + 8 } },
      { prop: "signpost", at: { x: hub.x + 2, z: hub.z + 20 } },
      { prop: "cannon", at: { x: harbour.x - 10, z: harbour.z + 4 }, rotation: 0.2 },
    ],
    beacons: [
      {
        id: "gallows", at: { x: platform.x, z: platform.z }, radius: 13, advancesStep: 1,
        text: "The platform where the age of pirates began.",
      },
    ],
    chests: [
      { at: { angle: 3.4, dist: 0.78 }, berries: 950, flag: "logue_chest" },
    ],
    enemies: [
      {
        id: "watch",
        when: { minStep: 2, maxStep: 2 },
        around: { x: harbour.x, z: harbour.z },
        radius: 22,
        count: 6,
        rewardEach: 180,
        clearAdvancesStep: 2,
        foe: {
          name: "Marine", title: "town watch", hp: 72, damage: 12, speed: 3.8,
          aggroRange: 24, look: MARINE,
        },
      },
    ],
    npcs: [
      {
        id: "merchant", name: "Ipponmatsu", role: "Merchant",
        at: { x: hub.x - 8, z: hub.z + 10 },
        look: {
          shirt: 0x6a5a4a, pants: 0x3a3a42, skin: 0xd8a87e, hairColor: 0x8a8880,
          accent: 0xc9a227, hat: "cap", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0, minBerries: 400 },
            lines: [
              "Grand Line, is it? You and every fool with a sail.",
              "Then you'll need charts, salt, rope and something to keep the rain off. Four hundred Berries, no haggling.",
            ],
            choices: [
              {
                label: "Pay 400 Berries for supplies.",
                lines: ["Sensible. Rare, in your line of work.", "Now go and look at the platform before you leave. Everyone does."],
                effects: { berries: -400, advance: true, flag: "logue_supplied" },
              },
              { label: "\"Not today.\"", lines: ["Suit yourself. The sea won't."] },
            ],
          },
          {
            when: { questStep: 0 },
            lines: [
              "Charts, salt, rope — four hundred Berries and you'd be ready for the Grand Line.",
              "Come back when your purse is heavier. Crack a chest or two; this town is full of them.",
            ],
          },
          {
            when: { questStep: 1 },
            lines: ["Go and stand under the platform. It's why people come here."] },
          {
            when: { minStep: 2 },
            lines: ["The whole watch is between you and your ship. That's the harbour for you."],
          },
        ],
      },
      {
        id: "harbourmaster", name: "Daddy", role: "Harbourmaster",
        at: { x: harbour.x + 6, z: harbour.z + 6 },
        look: {
          shirt: 0x4a5a6a, pants: 0x2a3a4a, skin: 0xc99a6a, hairColor: 0x5a4a3a,
          accent: 0x8a6a3a, hat: "tricorn", hair: "short", gear: "rifle",
        },
        talks: [
          {
            when: { maxStep: 2 },
            lines: ["Half the watch is on the quay. I'd stay away from my harbour today if I were you."],
          },
          {
            when: { questStep: 3 },
            lines: [
              "You went through the town watch like weather.",
              "South of here the sea stands up on its end and runs into a mountain. That's the way in. There's no other.",
              "Aim for the middle of the current and don't lose your nerve halfway up. Good luck, Captain.",
            ],
            effects: { completeIsland: true, berries: 600 },
          },
          {
            lines: ["Reverse Mountain, straight on. The sea does the climbing, you just hold the wheel."],
          },
        ],
      },
    ],
    quest: {
      title: "The Last Port",
      steps: [
        { objective: "Buy supplies from the merchant in the square. (400 Berries)", marker: "square" },
        { objective: "Go and stand beneath the execution platform.", marker: "platform" },
        { objective: "Cut through the town watch and reach the harbour.", marker: "harbour" },
        { objective: "Ask the harbourmaster the way into the Grand Line.", marker: "harbour" },
      ],
    },
  };
})();

// ============================================================================
// 8 — Reverse Mountain
// ============================================================================

const reverse = (() => {
  const light = polar(3.1, 54);
  return {
    id: "reverse",
    name: "Reverse Mountain",
    sea: "The Gate",
    blurb: "Where four seas climb a mountain and fall into the Grand Line.",
    tagline: "the only way in",
    world: { x: 4960, z: -1520 },
    climate: "rocky",
    dockAngle: 0.2,
    ambience: "wind",
    proxyFoliage: 12,
    palette: ROCKY,
    landSky: { ...STORM, fogDensity: 0.0022 },
    seaSky: STORM,
    seaWater: COLD_WATER,
    landWater: COLD_WATER,
    terrain: {
      radius: 140, baseHeight: 4.0, relief: 9.0, noiseScale: 42, shelfDepth: 20,
      peaks: [
        { x: 0, z: -16, height: 84, radius: 62 },
        { x: -48, z: 40, height: 26, radius: 34 },
      ],
      flats: [{ x: light.x, z: light.z, r: 24, height: 9.0 }],
    },
    places: {
      lighthouse: { x: light.x, z: light.z },
      summit: { x: 0, z: -16 },
    },
    scatter: [
      { prop: "pine", count: 30, band: { minH: 4, maxH: 46, maxSlope: 0.55 }, spacing: 6 },
      { prop: "rock", count: 60, band: { minH: 0.6, maxSlope: 1.0 }, spacing: 2.6, scale: [0.8, 1.6] },
      { prop: "boulder", count: 16, band: { minH: 2, maxH: 50, maxSlope: 0.7 }, spacing: 9 },
      { prop: "grassTuft", count: 50, band: { minH: 2, maxH: 20, maxSlope: 0.5 }, spacing: 2 },
    ],
    structures: [
      { prop: "watchtower", at: { x: light.x, z: light.z }, scale: 1.6 },
      { prop: "hut", at: { x: light.x + 14, z: light.z + 8 } },
      { prop: "signpost", at: { x: light.x - 2, z: light.z + 14 } },
      { prop: "barrel", at: { x: light.x + 6, z: light.z + 11 } },
    ],
    beacons: [
      {
        id: "summit", at: { x: 0, z: -16 }, radius: 24, advancesStep: 1,
        text: "Four seas, climbing. The water goes up and over — and so will you.",
      },
    ],
    chests: [
      { at: { angle: 1.4, dist: 0.7 }, berries: 800, flag: "reverse_chest" },
    ],
    npcs: [
      {
        id: "crocus", name: "Crocus", role: "Lighthouse Keeper",
        at: { x: light.x + 3, z: light.z + 9 },
        look: {
          shirt: 0xe8e0d0, pants: 0x4a4a52, skin: 0xd8a87e, hairColor: 0xc8c4bc,
          accent: 0x6a8a5a, hat: "none", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Another one. You'd be amazed how many crews sail all this way and turn around at the sight of it.",
              "The canal runs up the mountain and over. Get your bow into the current and hold it there.",
              "Go up and look at it first. Anyone who hasn't seen it doesn't believe me.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["Up the path, to the head of the canal. Look at it properly."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Now you've seen it. Still going?",
              "Then here's the only useful thing I'll tell you: on the other side, your compass is a decoration.",
              "The Log Pose records an island's magnetism and points at the next. Trust the needle, not the sky.",
              "Welcome to the Grand Line, Captain. Most of you don't come back. Some of you do.",
            ],
            effects: { completeIsland: true, berries: 500, flag: "entered_grand_line" },
          },
          {
            lines: ["The light's been burning fifty years. It'll burn a while yet."],
          },
        ],
      },
    ],
    quest: {
      title: "The Gate",
      steps: [
        { objective: "Find the lighthouse keeper at the cape.", marker: "lighthouse" },
        { objective: "Climb to the head of the canal and see it for yourself.", marker: "summit" },
        { objective: "Go back down to the keeper.", marker: "lighthouse" },
      ],
    },
  };
})();

// ============================================================================
// 9 — Whisky Peak
// ============================================================================

const whisky = (() => {
  const town = polar(0.6, 48);
  return {
    id: "whisky",
    name: "Whisky Peak",
    sea: "Grand Line",
    blurb: "A town of cactus-shaped roofs that welcomes every crew with a feast.",
    tagline: "the welcoming town",
    world: { x: 5680, z: -1080 },
    climate: "savanna",
    dockAngle: 0.6,
    ambience: "wind",
    palette: SAVANNA,
    landSky: { ...GOLDEN, fogDensity: 0.0016 },
    seaSky: GOLDEN,
    seaWater: WARM_WATER,
    terrain: {
      radius: 148, baseHeight: 3.4, relief: 7.0, noiseScale: 46, shelfDepth: 16,
      peaks: [
        { x: 44, z: -40, height: 34, radius: 34 },
        { x: -50, z: -30, height: 30, radius: 30 },
      ],
      flats: [{ x: town.x, z: town.z, r: 44, height: 5.0 }],
    },
    places: {
      town: { x: town.x, z: town.z },
      hall: { x: town.x, z: town.z - 12 },
    },
    scatter: [
      { prop: "cactus", count: 54, band: { minH: 2, maxSlope: 0.45 }, spacing: 4, scale: [0.8, 1.4] },
      { prop: "rock", count: 34, band: { minH: 0.8, maxSlope: 0.9 }, spacing: 3 },
      { prop: "grassTuft", count: 130, band: { minH: 2, maxSlope: 0.55 }, spacing: 1.3 },
      { prop: "broadleaf", count: 10, band: { minH: 3, maxH: 18, maxSlope: 0.35 }, spacing: 8 },
    ],
    structures: [
      ...ringOfHouses(town, 10, 28),
      ...ringOfHouses(town, 7, 48, "house", 0.7),
      { prop: "lamppost", at: { x: town.x - 9, z: town.z + 12 } },
      { prop: "lamppost", at: { x: town.x + 9, z: town.z + 12 } },
      { prop: "signpost", at: { x: town.x, z: town.z + 19 } },
      { prop: "barrel", at: { x: town.x + 12, z: town.z + 4 } },
      { prop: "barrel", at: { x: town.x + 13.4, z: town.z + 5.6 } },
      { prop: "crate", at: { x: town.x - 13, z: town.z + 2 } },
    ],
    chests: [
      { at: { angle: 4.2, dist: 0.72 }, berries: 1100, flag: "whisky_chest" },
    ],
    enemies: [
      {
        id: "hunters",
        when: { minStep: 1, maxStep: 1 },
        around: { x: town.x, z: town.z },
        radius: 26,
        count: 7,
        rewardEach: 220,
        clearAdvancesStep: 1,
        foe: {
          name: "Bounty Hunter", title: "Baroque Works", hp: 92, damage: 14, speed: 4.1,
          aggroRange: 26, look: HUNTER,
        },
      },
    ],
    npcs: [
      {
        id: "igaram", name: "Igarappoi", role: "Town Elder",
        at: { x: town.x + 2, z: town.z + 8 },
        look: {
          shirt: 0x9a4f6a, pants: 0x3a3a4a, skin: 0xd8a87e, hairColor: 0x2a2a2a,
          accent: 0xd8c06a, hat: "top", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Pirates! Wonderful! Truly, the finest thing to happen to this town all week!",
              "You must eat. You must drink. You must absolutely not go anywhere until you've done both.",
              "…Yes. Sit. The feast is quite ready. It has been ready for some time.",
            ],
            effects: { advance: true, flag: "whisky_feast" },
          },
          {
            when: { questStep: 1 },
            lines: ["Ah. You've noticed the knives. Well. This is awkward for everyone."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Enough! Stop — stop. You've beaten every hunter in the town, and I would very much like to stop being one.",
              "This town is a trap. Every crew that lands here is catalogued, robbed and sold to an organisation called Baroque Works.",
              "I was their agent. I am also — and this is the more important job — a guard to the princess of Alabasta.",
              "Her country is being pulled apart by the man who runs all this. Take her there. Please.",
            ],
            choices: [
              {
                label: "\"Bring her aboard. We're going to Alabasta.\"",
                lines: [
                  "You don't even ask what it pays.",
                  "Vivi! Get your things. …And Captain — from here the Log Pose takes three days to set. Use them.",
                ],
                effects: { recruit: "princess", completeIsland: true, berries: 900 },
              },
              {
                label: "\"Not my war.\"",
                lines: ["No. No, of course. …The offer will keep. Her country may not."],
              },
            ],
          },
          {
            lines: ["The cactus roofs were my idea. Nobody appreciates them."],
          },
        ],
      },
    ],
    quest: {
      title: "The Welcoming Town",
      steps: [
        { objective: "Accept the town's hospitality. Find the elder in the square.", marker: "town" },
        { objective: "Survive the ambush and clear the bounty hunters.", marker: "town" },
        { objective: "Get the truth out of the elder.", marker: "hall" },
      ],
    },
  };
})();

// ============================================================================
// 10 — Drum Island
// ============================================================================

const drum = (() => {
  const village = polar(0.9, 56);
  const castle = { x: 10, z: -46 };
  return {
    id: "drum",
    name: "Drum Island",
    sea: "Grand Line",
    blurb: "A winter island with a castle on the peak and no doctors left.",
    tagline: "the winter island",
    world: { x: 6380, z: -580 },
    climate: "snow",
    dockAngle: 0.9,
    ambience: "wind",
    proxyFoliage: 30,
    palette: SNOW,
    landSky: { ...COLD, fogDensity: 0.0024 },
    seaSky: COLD,
    seaWater: COLD_WATER,
    landWater: COLD_WATER,
    terrain: {
      radius: 152, baseHeight: 4.0, relief: 7.5, noiseScale: 44, shelfDepth: 18,
      peaks: [
        { x: 10, z: -46, height: 96, radius: 56 },
        { x: -54, z: -10, height: 38, radius: 30 },
        { x: 62, z: 14, height: 32, radius: 28 },
      ],
      flats: [
        { x: village.x, z: village.z, r: 34, height: 6.0 },
        { x: castle.x, z: castle.z, r: 20, height: 92.0 },
      ],
    },
    places: {
      village: { x: village.x, z: village.z },
      castle: { x: castle.x, z: castle.z },
    },
    scatter: [
      { prop: "pine", count: 78, band: { minH: 3, maxH: 70, maxSlope: 0.5 }, spacing: 5, scale: [0.8, 1.35] },
      { prop: "iceSpire", count: 26, band: { minH: 8, maxSlope: 0.8 }, spacing: 5 },
      { prop: "rock", count: 30, band: { minH: 1, maxSlope: 1.0 }, spacing: 3 },
      { prop: "boulder", count: 10, band: { minH: 3, maxH: 40, maxSlope: 0.6 }, spacing: 10 },
    ],
    structures: [
      ...ringOfHouses(village, 8, 24),
      { prop: "watchtower", at: { x: castle.x, z: castle.z }, scale: 2.2 },
      { prop: "watchtower", at: { x: castle.x - 14, z: castle.z + 8 }, scale: 1.3 },
      { prop: "watchtower", at: { x: castle.x + 14, z: castle.z + 8 }, scale: 1.3 },
      { prop: "flagpole", at: { x: castle.x, z: castle.z + 15 } },
      { prop: "signpost", at: { x: village.x, z: village.z + 15 } },
      { prop: "lamppost", at: { x: village.x - 8, z: village.z + 9 } },
    ],
    beacons: [
      {
        id: "reach_village", at: { x: village.x, z: village.z }, radius: 22, advancesStep: 0,
        text: "The village huddles under the peak. Every shutter is closed.",
      },
      {
        id: "reach_castle", at: { x: castle.x, z: castle.z }, radius: 26, advancesStep: 1,
        text: "The castle on the drum rock. Someone is still living up here.",
      },
    ],
    chests: [
      { at: { x: castle.x + 10, z: castle.z - 8 }, berries: 1400, flag: "drum_chest" },
    ],
    enemies: [
      {
        id: "brigands",
        when: { minStep: 1, maxStep: 1 },
        around: { x: 0, z: -14 },
        radius: 26,
        count: 4,
        rewardEach: 240,
        foe: {
          name: "Brigand", title: "the slopes", hp: 96, damage: 15, speed: 3.9,
          aggroRange: 24, look: { ...HUNTER, shirt: 0x4a5a6a, accent: 0xc84f4f },
        },
      },
    ],
    npcs: [
      {
        id: "dalton", name: "Dalton", role: "Villager",
        at: { x: village.x + 4, z: village.z + 8 },
        look: {
          shirt: 0x6a7a8a, pants: 0x3a4452, skin: 0xd8a87e, hairColor: 0x4a3a2a,
          accent: 0x8a6a3a, hat: "cap", hair: "short",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "You won't find a doctor here. The old king ran them all off the island years ago.",
              "There's one left. Up on the drum rock, in the castle — if the stories are true.",
              "It's a hard climb and there are brigands on the slope. But if someone on your crew is sick…",
            ],
          },
          {
            when: { minStep: 2 },
            lines: ["You made it up and back. Half this village owes you a winter's firewood."],
          },
        ],
      },
      {
        id: "chopper_castle", name: "Chopper", role: "Doctor",
        at: { x: castle.x + 4, z: castle.z + 10 },
        when: { lacksCrew: "doctor" },
        look: {
          shirt: 0xd06a5a, pants: 0x8a5a3a, skin: 0xd9a97f, hairColor: 0x8a5a3a,
          accent: 0xd94f4f, hat: "antlers", hair: "short", gear: "backpack", scale: 0.62,
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: ["Don't come any closer! …Please. People throw things."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "You climbed all the way up here and you're not holding a rock. That's new.",
              "I'm a doctor. A proper one — I was taught by the best one this island ever had, and everyone called her a witch too.",
              "Nobody comes up here to be treated. They come up to stare.",
            ],
            choices: [
              {
                label: "\"Be my crew's doctor. Come and see the world.\"",
                lines: [
                  "Your crew? Me? You're — you're just saying that. Say it again.",
                  "…I'll get my bag. I'll get my bag!",
                  "I'm not happy about this at all, you know. This is what not-happy looks like. Stop smiling.",
                ],
                effects: { recruit: "doctor", completeIsland: true, berries: 700 },
              },
              {
                label: "\"Just sheltering from the wind.\"",
                lines: ["Oh. …That's fine. The fire's lit. Stay as long as you need."],
              },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Doctorless Island",
      steps: [
        { objective: "Reach the village beneath the peak.", marker: "village" },
        { objective: "Climb the drum rock to the castle.", marker: "castle" },
        { objective: "Meet the doctor in the castle.", marker: "castle" },
      ],
    },
  };
})();

// ============================================================================
// 11 — Alabasta
// ============================================================================

const alabasta = (() => {
  const ruins = { x: -20, z: -58 };
  const oasis = polar(1.0, 52);
  return {
    id: "alabasta",
    name: "Alabasta",
    sea: "Grand Line",
    blurb: "A desert kingdom three years without rain, and one man profiting from it.",
    tagline: "the desert kingdom",
    world: { x: 7180, z: 120 },
    climate: "desert",
    dockAngle: 1.3,
    ambience: "wind",
    proxyFoliage: 18,
    palette: DESERT,
    landSky: { ...DUSTY, fogDensity: 0.0019 },
    seaSky: DUSTY,
    seaWater: WARM_WATER,
    terrain: {
      radius: 178, baseHeight: 4.2, relief: 8.0, noiseScale: 64, shelfDepth: 16,
      peaks: [
        { x: ruins.x, z: ruins.z, height: 40, radius: 46 },
        { x: 70, z: 40, height: 26, radius: 40 },
      ],
      flats: [
        { x: oasis.x, z: oasis.z, r: 34, height: 5.5 },
        { x: ruins.x, z: ruins.z, r: 26, height: 38.0 },
      ],
    },
    places: {
      oasis: { x: oasis.x, z: oasis.z },
      ruins: { x: ruins.x, z: ruins.z },
    },
    scatter: [
      { prop: "cactus", count: 64, band: { minH: 2, maxSlope: 0.5 }, spacing: 4, scale: [0.8, 1.5] },
      { prop: "rock", count: 44, band: { minH: 1, maxSlope: 0.95 }, spacing: 3.4 },
      { prop: "boulder", count: 14, band: { minH: 3, maxH: 34, maxSlope: 0.6 }, spacing: 11 },
      { prop: "palm", count: 16, band: { minH: 4.6, maxH: 7, maxSlope: 0.18 }, spacing: 5 },
      { prop: "grassTuft", count: 60, band: { minH: 4.6, maxH: 7, maxSlope: 0.3 }, spacing: 2 },
    ],
    structures: [
      ...ringOfHouses(oasis, 9, 26, "hut"),
      { prop: "watchtower", at: { x: ruins.x, z: ruins.z }, scale: 2.4 },
      { prop: "watchtower", at: { x: ruins.x - 18, z: ruins.z + 10 }, scale: 1.5 },
      { prop: "watchtower", at: { x: ruins.x + 18, z: ruins.z + 10 }, scale: 1.5 },
      { prop: "flagpole", at: { x: ruins.x, z: ruins.z + 18 } },
      { prop: "tent", at: { x: oasis.x + 16, z: oasis.z - 8 }, scale: 1.4 },
      { prop: "tent", at: { x: oasis.x - 16, z: oasis.z - 6 }, scale: 1.4 },
      { prop: "signpost", at: { x: oasis.x, z: oasis.z + 16 } },
    ],
    beacons: [
      {
        id: "reach_ruins", at: { x: ruins.x, z: ruins.z }, radius: 30, advancesStep: 0,
        text: "The old city on the plateau. Baroque Works have made it theirs.",
      },
    ],
    chests: [
      { at: { x: ruins.x + 14, z: ruins.z - 12 }, berries: 2000, flag: "alabasta_chest" },
      { at: { angle: 4.6, dist: 0.8 }, berries: 1200, flag: "alabasta_chest2" },
    ],
    enemies: [
      {
        id: "baroque",
        when: { minStep: 1, maxStep: 2 },
        around: { x: ruins.x, z: ruins.z + 10 },
        radius: 26,
        count: 8,
        rewardEach: 260,
        clearAdvancesStep: 1,
        boss: {
          id: "crocodile", name: "Crocodile", title: "Mr. 0", hp: 460, damage: 24, speed: 4.4,
          aggroRange: 34, attackCooldown: 1.5, reward: 8000, advancesStep: 2,
          at: { x: ruins.x, z: ruins.z - 8 },
          look: {
            shirt: 0x3a3a44, pants: 0x24242c, skin: 0xc99a6a, hairColor: 0x1a1a1a,
            accent: 0x6a5a3a, hat: "none", hair: "short", gear: "none", scale: 1.28,
          },
        },
        foe: {
          name: "Agent", title: "Baroque Works", hp: 104, damage: 16, speed: 4.0,
          aggroRange: 26, look: AGENT,
        },
      },
    ],
    npcs: [
      {
        id: "vivi_oasis", name: "Vivi", role: "Princess",
        at: { x: oasis.x + 3, z: oasis.z + 9 },
        look: {
          shirt: 0x7ec4e0, pants: 0xe8e3d8, skin: 0xefc09a, hairColor: 0x6aa8d8,
          accent: 0xd8d0c0, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Three years without rain. The rebels think the king did it. The king thinks the rebels are mad.",
              "Neither of them is wrong about the other, and both of them are wrong about the cause.",
              "He's up in the old city on the plateau. Everything runs out of there.",
            ],
          },
          {
            when: { questStep: 1 },
            lines: ["Their agents are all over the plateau. Get through them and he'll have to come out himself."],
          },
          {
            when: { questStep: 2 },
            lines: ["He's still up there. He won't run — he's never had to."] },
          {
            when: { questStep: 3 },
            lines: [
              "It's done. The whole country doesn't know it yet, but it's done.",
              "My father will want to thank you in front of everyone, so I'd leave before the speeches start.",
              "You crossed half the world for a country that wasn't yours. …I don't know how to say thank you for that. So I won't. I'll just come with you.",
            ],
            effects: { completeIsland: true, berries: 5000 },
          },
          {
            lines: ["Listen. That's rain on the sand. I'd forgotten the sound."],
          },
        ],
      },
      {
        id: "innkeeper_al", name: "Toto", role: "Well-digger",
        at: { x: oasis.x - 12, z: oasis.z + 4 },
        look: {
          shirt: 0xc9a86a, pants: 0x8a6a3a, skin: 0xa97048, hairColor: 0x8a8880,
          accent: 0x6a5a3a, hat: "cap", hair: "short",
        },
        talks: [
          {
            lines: [
              "Twelve years I've been digging this well. Everyone says there's no water.",
              "There's water. There's always water. You just have to be more stubborn than the sand.",
            ],
          },
        ],
      },
    ],
    quest: {
      title: "Three Years Without Rain",
      steps: [
        { objective: "Cross the dunes to the old city on the plateau.", marker: "ruins" },
        { objective: "Clear the Baroque Works agents from the ruins.", marker: "ruins" },
        { objective: "Defeat the man running all of it.", marker: "ruins" },
        { objective: "Find Vivi at the oasis.", marker: "oasis" },
      ],
    },
  };
})();

// ============================================================================
// 12 — Jaya
// ============================================================================

const jaya = (() => {
  const town = polar(2.2, 50);
  const headland = polar(5.3, 104);
  return {
    id: "jaya",
    name: "Jaya",
    sea: "Grand Line",
    blurb: "A lawless port where asking the wrong question gets you thrown through a window.",
    tagline: "the mock town",
    world: { x: 7900, z: 760 },
    climate: "tropical",
    dockAngle: 2.2,
    ambience: "shore",
    palette: JUNGLE,
    landSky: { ...GOLDEN, fogDensity: 0.0017 },
    seaSky: GOLDEN,
    seaWater: WARM_WATER,
    terrain: {
      radius: 152, baseHeight: 3.4, relief: 7.5, noiseScale: 50, shelfDepth: 17,
      peaks: [
        { x: -18, z: -40, height: 52, radius: 48 },
        { x: headland.x, z: headland.z, height: 26, radius: 26 },
      ],
      flats: [
        { x: town.x, z: town.z, r: 40, height: 5.0 },
        { x: headland.x, z: headland.z, r: 18, height: 23.0 },
      ],
    },
    places: {
      town: { x: town.x, z: town.z },
      headland: { x: headland.x, z: headland.z },
    },
    scatter: [
      { prop: "broadleaf", count: 56, band: { minH: 2, maxSlope: 0.5 }, spacing: 5, scale: [0.9, 1.5] },
      { prop: "palm", count: 30, band: { minH: 1.4, maxH: 10, maxSlope: 0.35 }, spacing: 5 },
      { prop: "rock", count: 32, band: { minH: 0.8, maxSlope: 0.95 }, spacing: 3 },
      { prop: "grassTuft", count: 140, band: { minH: 1.8, maxSlope: 0.55 }, spacing: 1.2 },
      { prop: "barrel", count: 18, band: { minH: 2.4, maxH: 10, maxSlope: 0.3 }, spacing: 2.4 },
    ],
    structures: [
      ...ringOfHouses(town, 10, 28),
      ...ringOfHouses(town, 5, 48, "house", 0.8),
      { prop: "signpost", at: { x: town.x, z: town.z + 17 } },
      { prop: "lamppost", at: { x: town.x - 9, z: town.z + 11 } },
      { prop: "lamppost", at: { x: town.x + 9, z: town.z + 11 } },
      { prop: "hut", at: { x: headland.x, z: headland.z }, scale: 1.2 },
      { prop: "flagpole", at: { x: headland.x + 9, z: headland.z + 5 } },
    ],
    chests: [
      { at: { angle: 0.4, dist: 0.62 }, berries: 1600, flag: "jaya_chest" },
    ],
    enemies: [
      {
        id: "bullies",
        when: { minStep: 1, maxStep: 1 },
        around: { x: town.x, z: town.z },
        radius: 22,
        count: 6,
        rewardEach: 260,
        clearAdvancesStep: 1,
        foe: {
          name: "Mock Town Tough", title: "the square", hp: 110, damage: 17, speed: 4.2,
          aggroRange: 24, look: BULLY,
        },
      },
    ],
    npcs: [
      {
        id: "cricket", name: "Cricket", role: "Cartographer",
        at: { x: headland.x, z: headland.z + 7 },
        look: {
          shirt: 0x6a7a8a, pants: 0x3a4452, skin: 0xc99a6a, hairColor: 0x8a8880,
          accent: 0x2f7f9f, hat: "none", hair: "spiky",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "Everyone in that town knows the way up and not one of them will tell you.",
              "Clear them out of the square and come back. Then we'll talk about the sky.",
            ],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Forty years they've laughed at me for saying there's an island in the sky.",
              "There is. A knock-up stream throws you there — a column of sea that goes straight up.",
              "Ride it and you'll make landfall on cloud. Miss it and you'll make landfall on the seabed.",
              "There's a woman waiting by your ship, by the way. Been there an hour. Didn't say a word.",
            ],
            effects: { advance: true },
          },
          {
            lines: ["Aim for the white water and hold your nerve. That's the whole trick."],
          },
        ],
      },
      {
        id: "robin_dock", name: "Robin", role: "Archaeologist",
        at: { shore: 2.2, shoreHeight: 2.6 },
        when: { lacksCrew: "archaeologist" },
        look: {
          shirt: 0x5a3f6a, pants: 0x2a2230, skin: 0xd8a87e, hairColor: 0x2a1d18,
          accent: 0xc9a227, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { maxStep: 2 },
            lines: ["Don't mind me. I'm reading."],
          },
          {
            when: { questStep: 3 },
            lines: [
              "You're going up. Of course you are.",
              "I've spent twenty years looking for the pieces of history someone went to enormous trouble to bury.",
              "Every crew that could have taken me there either sold me or sank. Yours has done neither yet.",
              "That's not much of a recommendation. It's more than I've had.",
            ],
            choices: [
              {
                label: "\"Come aboard. Read us the world.\"",
                lines: [
                  "You didn't ask what I want from it. That's either trust or carelessness.",
                  "I'll take either. Let's go and see a sky island.",
                ],
                effects: { recruit: "archaeologist", completeIsland: true, berries: 1200 },
              },
              { label: "\"Stay on your rock.\"", lines: ["Then I'll wait. I'm good at that."] },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Island in the Sky",
      steps: [
        { objective: "Ask after the sky island in Mock Town.", marker: "town" },
        { objective: "The town answers questions with fists. Clear the square.", marker: "town" },
        { objective: "Find the cartographer on the southern headland.", marker: "headland" },
        { objective: "Speak to the woman waiting by your ship.", marker: "dock" },
      ],
    },
  };
})();

// ============================================================================
// 13 — Skypiea
// ============================================================================

const skypiea = (() => {
  const ruins = { x: 4, z: -36 };
  const village = polar(1.2, 58);
  return {
    id: "skypiea",
    name: "Skypiea",
    sea: "The White Sea",
    blurb: "An island that floats on cloud, ten thousand metres above the water you came from.",
    tagline: "the sea of clouds",
    world: { x: 8560, z: 1420 },
    climate: "sky",
    dockAngle: 1.2,
    ambience: "wind",
    proxyFoliage: 26,
    palette: SKY_ISLE,
    landSky: { ...RAREFIED, fogDensity: 0.0011 },
    seaSky: RAREFIED,
    seaWater: CLOUD_SEA,
    landWater: CLOUD_SEA,
    terrain: {
      radius: 146, baseHeight: 4.2, relief: 5.5, noiseScale: 54, shelfDepth: 13,
      peaks: [{ x: ruins.x, z: ruins.z, height: 46, radius: 44 }],
      flats: [
        { x: village.x, z: village.z, r: 34, height: 6.0 },
        { x: ruins.x, z: ruins.z, r: 24, height: 44.0 },
      ],
    },
    places: {
      village: { x: village.x, z: village.z },
      ruins: { x: ruins.x, z: ruins.z },
    },
    scatter: [
      { prop: "broadleaf", count: 44, band: { minH: 2.4, maxSlope: 0.45 }, spacing: 6, scale: [0.9, 1.4] },
      { prop: "cloudPuff", count: 70, band: { minH: 1.2, maxH: 8, maxSlope: 0.6 }, spacing: 2.2 },
      { prop: "rock", count: 22, band: { minH: 2, maxSlope: 0.9 }, spacing: 3.4 },
      { prop: "grassTuft", count: 150, band: { minH: 2.4, maxSlope: 0.55 }, spacing: 1.2 },
    ],
    structures: [
      ...ringOfHouses(village, 7, 25, "hut"),
      { prop: "watchtower", at: { x: ruins.x, z: ruins.z }, scale: 2.1 },
      { prop: "watchtower", at: { x: ruins.x - 20, z: ruins.z + 12 }, scale: 1.2 },
      { prop: "watchtower", at: { x: ruins.x + 20, z: ruins.z + 12 }, scale: 1.2 },
      { prop: "flagpole", at: { x: ruins.x, z: ruins.z + 20 } },
      { prop: "signpost", at: { x: village.x, z: village.z + 14 } },
    ],
    beacons: [
      {
        id: "reach_ruins", at: { x: ruins.x, z: ruins.z }, radius: 26, advancesStep: 0,
        text: "Gold and white stone, and a bell that has not been rung in four hundred years.",
      },
    ],
    chests: [
      { at: { x: ruins.x + 13, z: ruins.z - 10 }, berries: 2400, flag: "sky_chest" },
    ],
    enemies: [
      {
        id: "trial",
        when: { minStep: 1, maxStep: 1 },
        around: { x: ruins.x, z: ruins.z + 12 },
        radius: 24,
        count: 6,
        rewardEach: 300,
        clearAdvancesStep: 1,
        foe: {
          name: "Priest", title: "the trial", hp: 128, damage: 19, speed: 4.3,
          aggroRange: 28, look: PRIEST,
        },
      },
    ],
    npcs: [
      {
        id: "ganfall", name: "Gan Fall", role: "Sky Knight",
        at: { x: village.x + 4, z: village.z + 9 },
        look: {
          shirt: 0xe4e8ea, pants: 0x9aa4ac, skin: 0xd8a87e, hairColor: 0xd8d4cc,
          accent: 0xe8c84a, hat: "tricorn", hair: "short", gear: "staff",
        },
        talks: [
          {
            when: { maxStep: 1 },
            lines: [
              "Blue sea dwellers. We don't get many, and they don't often leave.",
              "The priests hold the upper ring and call it a trial. It is mostly an ambush.",
            ],
          },
          {
            when: { questStep: 2 },
            lines: [
              "You beat the trial. Four hundred years and nobody had simply refused to lose it.",
              "Ring the bell before you go. There is a city down there under the cloud that has been waiting to hear it.",
              "Then follow the current down. And thank you — from a country that had stopped expecting help.",
            ],
            effects: { completeIsland: true, berries: 1500 },
          },
          {
            lines: ["The bell carries a long way. They will have heard it."],
          },
        ],
      },
      {
        id: "conis", name: "Conis", role: "Islander",
        at: { x: village.x - 11, z: village.z + 5 },
        look: {
          shirt: 0xf0f2ee, pants: 0xd8cfa8, skin: 0xefc09a, hairColor: 0xe8d88a,
          accent: 0x7ec4e0, hat: "none", hair: "long",
        },
        talks: [
          {
            lines: [
              "You fell out of the sky and you're worried about the clouds being solid.",
              "Walk on them. They hold. Everything up here holds, except the people.",
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Bell of Shandora",
      steps: [
        { objective: "Climb to the white stone ruins.", marker: "ruins" },
        { objective: "The priests call it a trial. Survive it.", marker: "ruins" },
        { objective: "Find the sky knight in the village.", marker: "village" },
      ],
    },
  };
})();

// ============================================================================
// 14 — Water Seven
// ============================================================================

const water7 = (() => {
  const city = polar(0.5, 44);
  const yard = polar(3.6, 74);
  return {
    id: "water7",
    name: "Water Seven",
    sea: "Grand Line",
    blurb: "A city of canals and shipwrights, slowly sinking and entirely unbothered by it.",
    tagline: "the city of water",
    world: { x: 9260, z: 2000 },
    climate: "town",
    dockAngle: 0.5,
    ambience: "shore",
    palette: CANAL,
    landSky: { ...CLEAR, fogDensity: 0.0015 },
    seaSky: CLEAR,
    seaWater: BLUE_WATER,
    terrain: {
      radius: 168, baseHeight: 4.0, relief: 5.0, noiseScale: 58, shelfDepth: 16,
      peaks: [{ x: city.x, z: city.z, height: 30, radius: 52 }],
      flats: [
        { x: city.x, z: city.z, r: 46, height: 26.0 },
        { x: yard.x, z: yard.z, r: 34, height: 4.5 },
      ],
    },
    places: {
      city: { x: city.x, z: city.z },
      yard: { x: yard.x, z: yard.z },
    },
    scatter: [
      { prop: "broadleaf", count: 26, band: { minH: 2, maxSlope: 0.4 }, spacing: 7 },
      { prop: "lamppost", count: 22, band: { minH: 3.5, maxSlope: 0.18 }, spacing: 8 },
      { prop: "crate", count: 34, band: { minH: 2.4, maxSlope: 0.3 }, spacing: 2.3 },
      { prop: "barrel", count: 28, band: { minH: 2.4, maxSlope: 0.3 }, spacing: 2.3 },
      { prop: "rock", count: 18, band: { minH: 0.8, maxSlope: 0.9 }, spacing: 3.4 },
    ],
    structures: [
      ...ringOfHouses(city, 12, 26),
      ...ringOfHouses(city, 10, 46, "house", 0.9),
      { prop: "watchtower", at: { x: city.x, z: city.z }, scale: 2.3 },
      { prop: "windmill", at: { x: city.x + 30, z: city.z - 24 } },
      ...ringOfHouses(yard, 6, 22),
      { prop: "cannon", at: { x: yard.x + 12, z: yard.z + 8 }, rotation: 0.3 },
      { prop: "signpost", at: { x: yard.x, z: yard.z + 15 } },
      { prop: "flagpole", at: { x: city.x, z: city.z + 22 } },
    ],
    chests: [
      {
        at: { x: city.x - 16, z: city.z - 14 }, berries: 1200, item: "Stolen blueprints",
        flag: "w7_blueprints", advancesStep: 1,
      },
      { at: { angle: 5.0, dist: 0.7 }, berries: 1800, flag: "w7_chest" },
    ],
    enemies: [
      {
        id: "wreckers",
        when: { minStep: 2, maxStep: 2 },
        around: { x: yard.x, z: yard.z },
        radius: 24,
        count: 7,
        rewardEach: 320,
        clearAdvancesStep: 2,
        foe: {
          name: "Dismantler", title: "the yard", hp: 132, damage: 20, speed: 4.2,
          aggroRange: 26, look: WRECKER,
        },
      },
    ],
    npcs: [
      {
        id: "iceburg", name: "Iceburg", role: "Foreman",
        at: { x: city.x + 5, z: city.z + 10 },
        look: {
          shirt: 0x2f5f7a, pants: 0x2a2f38, skin: 0xd8a87e, hairColor: 0x2a2a30,
          accent: 0xc9a227, hat: "none", hair: "short",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "Your ship is tired. I can hear it from here, and I've not even seen her keel.",
              "I'd have my yard put her right, except somebody walked out of my drawing office last night with the plans.",
              "Find them and the yard is yours. They can't have gone far — nobody leaves this city in a hurry, it's mostly water.",
            ],
            effects: { advance: true },
          },
          {
            when: { questStep: 1 },
            lines: ["Upper city. Try the empty houses on the north terrace."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Those aren't thieves, they're a demolition crew. Somebody wants this yard shut.",
              "Get them off my slipway.",
            ],
          },
          {
            when: { questStep: 3 },
            lines: [
              "Yard's yours, as promised. There's a man down there who'll do the work.",
              "He'll tell you he isn't interested. He'll have started before he finishes saying it.",
            ],
          },
          { lines: ["Come back any time. She'll need it, the way you sail."] },
        ],
      },
      {
        id: "franky_yard", name: "Franky", role: "Shipwright",
        at: { x: yard.x - 3, z: yard.z + 8 },
        when: { lacksCrew: "shipwright" },
        look: {
          shirt: 0x2f8fbf, pants: 0x2f3a4a, skin: 0xd8a87e, hairColor: 0x5fc8e8,
          accent: 0xe8d24a, hat: "none", hair: "spiky",
        },
        talks: [
          {
            when: { maxStep: 2 },
            lines: ["Busy. There's men with hammers on my slipway and none of them work here."],
          },
          {
            when: { questStep: 3 },
            lines: [
              "You cleared my yard and you didn't put a mark on the timber doing it. Noted.",
              "I looked over your caravel while you were busy. She's been well loved and badly used.",
              "Whoever built her meant her to go a long way. Nobody's asked her to properly yet.",
            ],
            choices: [
              {
                label: "\"Then come and ask her. Be our shipwright.\"",
                lines: [
                  "Leave my city? My yard? My — ",
                  "…She'd make the New World. With me aboard she'd make it twice.",
                  "Fine. FINE. Somebody get my tools. I'm not crying, it's the sawdust.",
                ],
                effects: { recruit: "shipwright", completeIsland: true, berries: 1800 },
              },
              { label: "\"Just here for repairs.\"", lines: ["Then she'll be sound by morning. Pity."] },
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Sinking City",
      steps: [
        { objective: "Find the foreman in the upper city.", marker: "city" },
        { objective: "Recover the stolen blueprints from the north terrace.", marker: "city" },
        { objective: "Clear the demolition crew off the shipyard.", marker: "yard" },
        { objective: "Talk to the shipwright in the yard.", marker: "yard" },
      ],
    },
  };
})();

// ============================================================================
// 15 — Thriller Bark
// ============================================================================

const thriller = (() => {
  const mansion = { x: -6, z: -44 };
  const yard = polar(0.9, 62);
  return {
    id: "thriller",
    name: "Thriller Bark",
    sea: "Grand Line",
    blurb: "An island-sized ship, drifting in permanent fog, and nothing on it casts a shadow.",
    tagline: "the haunted island",
    world: { x: 9980, z: 2520 },
    climate: "haunted",
    dockAngle: 0.9,
    ambience: "wind",
    proxyFoliage: 34,
    palette: HAUNTED,
    landSky: { ...MOONLIT, fogDensity: 0.0038 },
    seaSky: MOONLIT,
    seaWater: BLACK_WATER,
    landWater: BLACK_WATER,
    terrain: {
      radius: 154, baseHeight: 3.6, relief: 6.5, noiseScale: 46, shelfDepth: 18,
      peaks: [{ x: mansion.x, z: mansion.z, height: 40, radius: 46 }],
      flats: [
        { x: mansion.x, z: mansion.z, r: 30, height: 38.0 },
        { x: yard.x, z: yard.z, r: 26, height: 5.0 },
      ],
    },
    places: {
      mansion: { x: mansion.x, z: mansion.z },
      graveyard: { x: yard.x, z: yard.z },
    },
    scatter: [
      { prop: "deadTree", count: 78, band: { minH: 1.8, maxSlope: 0.55 }, spacing: 4.2, scale: [0.85, 1.5] },
      { prop: "gravestone", count: 60, band: { minH: 2, maxSlope: 0.4 }, spacing: 2.4 },
      { prop: "rock", count: 30, band: { minH: 1, maxSlope: 0.95 }, spacing: 3.2 },
      { prop: "lamppost", count: 12, band: { minH: 3, maxSlope: 0.2 }, spacing: 9 },
    ],
    structures: [
      { prop: "watchtower", at: { x: mansion.x, z: mansion.z }, scale: 2.6 },
      { prop: "watchtower", at: { x: mansion.x - 22, z: mansion.z + 14 }, scale: 1.5 },
      { prop: "watchtower", at: { x: mansion.x + 22, z: mansion.z + 14 }, scale: 1.5 },
      { prop: "fence", at: { x: mansion.x - 6, z: mansion.z + 26 }, rotation: 1.57 },
      { prop: "fence", at: { x: mansion.x + 6, z: mansion.z + 26 }, rotation: 1.57 },
      ...ringOfHouses(yard, 5, 22),
      { prop: "signpost", at: { x: yard.x, z: yard.z + 14 } },
    ],
    beacons: [
      {
        id: "reach_gates", at: { x: mansion.x, z: mansion.z + 24 }, radius: 24, advancesStep: 0,
        text: "The gates stand open. Nothing here throws a shadow, including you.",
      },
    ],
    chests: [
      { at: { x: mansion.x + 14, z: mansion.z - 12 }, berries: 2600, flag: "bark_chest" },
    ],
    enemies: [
      {
        id: "revenants",
        when: { minStep: 1, maxStep: 1 },
        around: { x: mansion.x, z: mansion.z + 10 },
        radius: 28,
        count: 9,
        rewardEach: 300,
        clearAdvancesStep: 1,
        foe: {
          name: "Revenant", title: "the grounds", hp: 118, damage: 18, speed: 3.6,
          aggroRange: 30, look: REVENANT,
        },
      },
    ],
    npcs: [
      {
        id: "brook_hall", name: "Brook", role: "Musician",
        at: { x: mansion.x + 3, z: mansion.z + 12 },
        when: { lacksCrew: "musician" },
        look: {
          shirt: 0x1f1f28, pants: 0x14141a, skin: 0xe8e4d8, hairColor: 0x2a2a34,
          accent: 0x9a3f5a, hat: "top", hair: "long", gear: "staff", scale: 1.18,
        },
        talks: [
          {
            when: { maxStep: 0 },
            lines: ["Someone is playing in the hall. It stops when you get close."],
          },
          {
            when: { questStep: 1 },
            lines: ["Please — clear the grounds first. I have been interrupted for fifty years."],
          },
          {
            when: { questStep: 2 },
            lines: [
              "Fifty years on this island with nobody to play to.",
              "I kept playing anyway. You get very good, and very strange.",
              "There is a crew I promised to meet again, and I am the only one left who remembers promising.",
              "So I have a choice: keep waiting on a dead ship, or go and find out how the song ends.",
            ],
            choices: [
              {
                label: "\"Come and play for us instead.\"",
                lines: [
                  "You would have me? Knowing what I am?",
                  "…Then let me fetch my violin, and we will never have a quiet watch again.",
                  "A voyage without music is just damp travelling, Captain.",
                ],
                effects: { recruit: "musician", completeIsland: true, berries: 2000 },
              },
              { label: "\"Some promises keep you.\"", lines: ["Yes. They do. Fair winds to you."] },
            ],
          },
        ],
      },
      {
        id: "lola", name: "Lola", role: "Survivor",
        at: { x: yard.x - 8, z: yard.z + 6 },
        look: {
          shirt: 0x8a4f6a, pants: 0x3a3440, skin: 0xd8a87e, hairColor: 0xc06a8a,
          accent: 0xe0a0b8, hat: "none", hair: "long",
        },
        talks: [
          {
            lines: [
              "Don't go up to the house. Everyone says that and everyone goes anyway.",
              "If you do get out — take the one playing the violin with you. He's been alone longer than anyone should be.",
            ],
          },
        ],
      },
    ],
    quest: {
      title: "The Island That Casts No Shadow",
      steps: [
        { objective: "Walk up to the mansion gates.", marker: "mansion" },
        { objective: "Clear the grounds of whatever walks there.", marker: "mansion" },
        { objective: "Find the musician in the hall.", marker: "mansion" },
      ],
    },
  };
})();

// ============================================================================
// 16 — Sabaody Archipelago
// ============================================================================

const sabaody = (() => {
  const grove = polar(1.8, 56);
  const auction = polar(4.6, 78);
  return {
    id: "sabaody",
    name: "Sabaody Archipelago",
    sea: "Grand Line",
    blurb: "Mangroves the size of mountains, and the last stop before the New World.",
    tagline: "the last archipelago",
    world: { x: 10780, z: 2980 },
    climate: "tropical",
    dockAngle: 1.8,
    ambience: "shore",
    proxyFoliage: 40,
    palette: MANGROVE,
    landSky: { ...GOLDEN, fogDensity: 0.0016 },
    seaSky: GOLDEN,
    seaWater: WARM_WATER,
    terrain: {
      radius: 180, baseHeight: 3.6, relief: 6.0, noiseScale: 62, shelfDepth: 16,
      flats: [
        { x: grove.x, z: grove.z, r: 36, height: 5.5 },
        { x: auction.x, z: auction.z, r: 30, height: 6.5 },
      ],
    },
    places: {
      grove: { x: grove.x, z: grove.z },
      auction: { x: auction.x, z: auction.z },
    },
    scatter: [
      { prop: "mangrove", count: 26, band: { minH: 2, maxSlope: 0.4 }, spacing: 22, scale: [0.85, 1.3] },
      { prop: "broadleaf", count: 40, band: { minH: 2, maxSlope: 0.5 }, spacing: 6 },
      { prop: "grassTuft", count: 160, band: { minH: 1.8, maxSlope: 0.55 }, spacing: 1.2 },
      { prop: "rock", count: 24, band: { minH: 0.8, maxSlope: 0.9 }, spacing: 3.4 },
      { prop: "coral", count: 18, band: { minH: 0.9, maxH: 2.6, maxSlope: 0.6 }, spacing: 3 },
    ],
    structures: [
      ...ringOfHouses(grove, 8, 26),
      { prop: "signpost", at: { x: grove.x, z: grove.z + 16 } },
      { prop: "lamppost", at: { x: grove.x - 9, z: grove.z + 10 } },
      { prop: "watchtower", at: { x: auction.x, z: auction.z }, scale: 2.0 },
      { prop: "tent", at: { x: auction.x + 16, z: auction.z + 6 }, scale: 1.6 },
      { prop: "tent", at: { x: auction.x - 16, z: auction.z + 6 }, scale: 1.6 },
      { prop: "cannon", at: { x: auction.x, z: auction.z + 18 }, rotation: 0 },
    ],
    beacons: [
      {
        id: "reach_grove", at: { x: grove.x, z: grove.z }, radius: 24, advancesStep: 0,
        text: "Roots like cathedral arches, and bubbles coming up through the moss.",
      },
    ],
    chests: [
      { at: { x: auction.x + 15, z: auction.z - 13 }, berries: 3000, flag: "sab_chest" },
      { at: { angle: 3.0, dist: 0.66 }, berries: 2200, flag: "sab_chest2" },
    ],
    enemies: [
      {
        id: "auctioneers",
        when: { minStep: 1, maxStep: 2 },
        around: { x: auction.x, z: auction.z + 10 },
        radius: 26,
        count: 9,
        rewardEach: 340,
        clearAdvancesStep: 1,
        boss: {
          id: "auctioneer", name: "The Auctioneer", title: "Sabaody", hp: 520, damage: 26,
          speed: 4.4, aggroRange: 34, attackCooldown: 1.5, reward: 9000, advancesStep: 2,
          at: { x: auction.x, z: auction.z - 8 },
          look: {
            shirt: 0x2a2a34, pants: 0x1a1a22, skin: 0xd8a87e, hairColor: 0x8a8a92,
            accent: 0xc9a227, hat: "top", hair: "short", gear: "swords", scale: 1.3,
          },
        },
        foe: {
          name: "Enforcer", title: "the auction", hp: 140, damage: 21, speed: 4.2,
          aggroRange: 28, look: SLAVER,
        },
      },
    ],
    npcs: [
      {
        id: "rayleigh", name: "Rayleigh", role: "Coating Craftsman",
        at: { x: grove.x + 4, z: grove.z + 9 },
        look: {
          shirt: 0xe8e2d2, pants: 0x3a3a44, skin: 0xd8a87e, hairColor: 0xd8d4cc,
          accent: 0x8a6a3a, hat: "none", hair: "long",
        },
        talks: [
          {
            when: { questStep: 0 },
            lines: [
              "You've come a long way on a small ship. That's usually a sign of a good crew or a mad captain.",
              "I coat hulls for the dive into the New World. It's slow work and I'm in no hurry.",
              "There's an auction house up the coast selling people. Deal with that first, and we'll talk about your ship.",
            ],
          },
          {
            when: { minStep: 1, maxStep: 2 },
            lines: ["The auction house. Up the coast. I'll have the resin ready."],
          },
          {
            when: { questStep: 3 },
            lines: [
              "It's quiet up there for the first time in thirty years.",
              "Your hull's coated. She'll hold pressure now, which is the only thing standing between you and the far side.",
              "I sailed with a captain once who talked like you do. He made it all the way.",
              "So will you. Go on — the Log Pose has nothing left to teach you.",
            ],
            effects: { completeIsland: true, berries: 6000 },
          },
          { lines: ["The resin sets slowly. So does a reputation. Both are worth the wait."] },
        ],
      },
    ],
    quest: {
      title: "The Last Archipelago",
      steps: [
        { objective: "Walk into the mangrove grove.", marker: "grove" },
        { objective: "Break up the auction house up the coast.", marker: "auction" },
        { objective: "Deal with the man running it.", marker: "auction" },
        { objective: "Return to the coating craftsman.", marker: "grove" },
      ],
    },
  };
})();

// ============================================================================
// Traders
// ============================================================================

/** Prices. Flat rather than escalating, and capped at three levels each. */
const PRICE = { meal: 150, patch: 500, sail: 2200, cannon: 2600, plate: 3200 };
const MAX_LEVEL = 3;

const level = (p, kind) => p.upgrades?.[kind] ?? 0;
const money = (n) => "฿" + n.toLocaleString("en-US");

/**
 * A chandler on the quay.
 *
 * Built out of the ordinary dialogue system rather than a bespoke shop screen:
 * a purchase is a conversation choice whose effects happen to move Berries and
 * bump an upgrade. Choices are gated on what you can afford and on what you
 * have already bought, so the list only ever shows real options.
 */
function shopkeeper(island, { name, greeting, look }) {
  return {
    id: "trader:" + island.id,
    name,
    role: "Chandler",
    at: { shore: (island.dockAngle ?? 0) + 0.5, shoreHeight: 2.4 },
    look: look || {
      shirt: 0x6a5a4a, pants: 0x3f3a32, skin: 0xd8a87e, hairColor: 0x6a5a4a,
      accent: 0xc9a227, hat: "cap", hair: "short",
    },
    talks: [
      {
        lines: [greeting],
        choices: [
          {
            label: () => `Hot meal — ${money(PRICE.meal)}`,
            when: { minBerries: PRICE.meal },
            lines: ["Sit down and eat it properly. You'll keep it down better."],
            effects: { berries: -PRICE.meal, heal: 55 },
          },
          {
            label: () => `Patch the hull — ${money(PRICE.patch)}`,
            when: { minBerries: PRICE.patch },
            lines: ["Oakum and tar. She'll hold."],
            effects: { berries: -PRICE.patch, repair: 70 },
          },
          {
            label: (p) => `Better rigging (lvl ${level(p, "sail") + 1}) — ${money(PRICE.sail)}`,
            when: { minBerries: PRICE.sail, upgradeUnder: { kind: "sail", level: MAX_LEVEL } },
            lines: ["New sheets and a lighter yard. She'll find another knot in her."],
            effects: { berries: -PRICE.sail, upgrade: "sail" },
          },
          {
            label: (p) => `Heavier shot (lvl ${level(p, "cannon") + 1}) — ${money(PRICE.cannon)}`,
            when: { minBerries: PRICE.cannon, upgradeUnder: { kind: "cannon", level: MAX_LEVEL } },
            lines: ["Bored true and packed tight. Load faster, hit harder."],
            effects: { berries: -PRICE.cannon, upgrade: "cannon" },
          },
          {
            label: (p) => `Hull plating (lvl ${level(p, "hull") + 1}) — ${money(PRICE.plate)}`,
            when: { minBerries: PRICE.plate, upgradeUnder: { kind: "hull", level: MAX_LEVEL } },
            lines: ["Doubled from the waterline up. Sea kings don't read plans."],
            effects: { berries: -PRICE.plate, upgrade: "hull" },
          },
          { label: "Nothing today.", lines: ["Fair winds, then."] },
        ],
      },
    ],
  };
}

const TRADERS = {
  shells: { name: "Bogart", greeting: "Marines don't pay. Pirates do. What'll it be?" },
  orange: { name: "Boodle's Niece", greeting: "Half this stock was looted back off the circus. Bargain, really." },
  syrup: { name: "Merry", greeting: "Ship's chandler. If it goes on a boat, I have it." },
  baratie: { name: "Patty", greeting: "Galley's through there. Ship's stores are out here. Don't confuse them." },
  logue: { name: "Ipponmatsu", greeting: "Last honest prices before the Grand Line. Enjoy them." },
  whisky: { name: "Mr. 8", greeting: "Now that we're all being truthful — I do also sell rope." },
  drum: { name: "Dalton's Cousin", greeting: "Everything's twice the price and half the stock. It's a winter island." },
  alabasta: { name: "Toto's Boy", greeting: "Water's dearer than powder here. Both are for sale." },
  jaya: { name: "Masira", greeting: "Cash only, no questions, and don't touch the salvage." },
  water7: { name: "Kalifa", greeting: "The yard's rates are posted. They are not negotiable." },
  thriller: { name: "Lola", greeting: "You'd be amazed what washes up here. Some of it's even useful." },
  sabaody: { name: "Shakky", greeting: "Last honest bar before the New World. Sit down." },
};

for (const island of Object.values({
  foosha, shells, orange, syrup, baratie, arlong, logue, reverse, whisky, drum,
  alabasta, jaya, skypiea, water7, thriller, sabaody,
})) {
  const spec = TRADERS[island.id];
  if (!spec) continue;
  (island.npcs = island.npcs || []).push(shopkeeper(island, spec));
}

/** The voyage, in order. The Log Pose walks this list from top to bottom. */
export const ROUTE = [
  foosha, shells, orange, syrup, baratie, arlong,
  logue, reverse, whisky, drum, alabasta,
  jaya, skypiea, water7, thriller, sabaody,
];

export const islandById = (id) => ROUTE.find((i) => i.id === id) || null;
