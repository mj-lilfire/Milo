/**
 * The crew you gather along the way.
 *
 * Everyone is described rather than modelled — `look` feeds the procedural
 * character builder, so a crewmate is a few dozen bytes and still has a
 * distinct silhouette on deck.
 *
 * This is an original fan prototype: all art and geometry here is generated
 * from these descriptions, not taken from any published work.
 */
export const CREW = [
  {
    id: "swordsman",
    name: "Zoro",
    role: "Swordsman",
    color: "#3f7d4a",
    quip: "Wake me when there's something worth cutting.",
    look: {
      shirt: 0x2f6f4a, pants: 0x22272e, skin: 0xe3b184,
      hairColor: 0x4f7a3a, accent: 0x2f7f4f,
      hat: "bandana", hair: "short", gear: "swords",
    },
    shipTalks: [
      {
        when: { flag: "lost_zoro" },
        lines: ["Don't look at me. The ship turned, not me.", "…Which way is the galley again?"],
      },
      {
        lines: [
          "Three swords, one captain, no complaints.",
          "Point me at whatever's in the way and I'll handle it.",
        ],
        effects: { flag: "lost_zoro" },
      },
    ],
  },
  {
    id: "navigator",
    name: "Nami",
    role: "Navigator",
    color: "#e0762f",
    quip: "The Log Pose is set. Try not to sink us.",
    look: {
      shirt: 0xe8e3d8, pants: 0x2f4f7a, skin: 0xefc09a,
      hairColor: 0xe0762f, accent: 0xd85a3a,
      hat: "none", hair: "long", gear: "staff",
    },
    shipTalks: [
      {
        lines: [
          "The Log Pose takes its own sweet time on each island. Don't rush it.",
          "Keep the needle on the mark and the sails full. That's the whole job.",
          "And every Berry we pick up is going in my ledger, Captain.",
        ],
      },
    ],
  },
  {
    id: "sniper",
    name: "Usopp",
    role: "Sniper",
    color: "#c9a227",
    quip: "I've got eight thousand men. They're just… elsewhere.",
    look: {
      shirt: 0xd8b23a, pants: 0x6b4a2a, skin: 0xa97048,
      hairColor: 0x2a1d12, accent: 0xc9a227,
      hat: "bandana", hair: "short", gear: "slingshot",
    },
    shipTalks: [
      {
        lines: [
          "From the crow's nest I can see trouble coming an hour out.",
          "Which is exactly an hour more than I'd like, frankly.",
        ],
      },
    ],
  },
  {
    id: "cook",
    name: "Sanji",
    role: "Cook",
    color: "#2b2b38",
    quip: "Nobody starves on my ship. Not even you.",
    look: {
      shirt: 0x23232e, pants: 0x1a1a22, skin: 0xefc09a,
      hairColor: 0xe8cf6a, accent: 0xd8d0c0,
      hat: "none", hair: "swirl", gear: "none",
    },
    shipTalks: [
      {
        lines: [
          "There's a pot on the stove and a knife with your name on it if you touch it early.",
          "A crew that eats well sails well. That's not philosophy, that's arithmetic.",
        ],
      },
    ],
  },
  {
    id: "doctor",
    name: "Chopper",
    role: "Doctor",
    color: "#c86a5a",
    quip: "I'm not cute! …Say it again though.",
    look: {
      shirt: 0xd06a5a, pants: 0x8a5a3a, skin: 0xd9a97f,
      hairColor: 0x8a5a3a, accent: 0xd94f4f,
      hat: "antlers", hair: "short", gear: "backpack", scale: 0.62,
    },
    shipTalks: [
      {
        lines: [
          "I've stocked the cabin. Bandages, tinctures, and something awful for seasickness.",
          "Tell me the moment anything hurts. Captains are the worst about that.",
        ],
      },
    ],
  },
  {
    id: "princess",
    name: "Vivi",
    role: "Diplomat",
    color: "#5aa9d0",
    quip: "My country is close now. Thank you for this.",
    look: {
      shirt: 0x7ec4e0, pants: 0xe8e3d8, skin: 0xefc09a,
      hairColor: 0x6aa8d8, accent: 0xd8d0c0,
      hat: "none", hair: "long", gear: "none",
    },
    shipTalks: [
      {
        lines: [
          "The desert looks empty from the sea. It isn't.",
          "Whatever we find in Alabasta — we finish it together.",
        ],
      },
    ],
  },
  {
    id: "archaeologist",
    name: "Robin",
    role: "Archaeologist",
    color: "#6a4a7a",
    quip: "I'd like to see how this ends. That's all.",
    look: {
      shirt: 0x5a3f6a, pants: 0x2a2230, skin: 0xd8a87e,
      hairColor: 0x2a1d18, accent: 0xc9a227,
      hat: "none", hair: "long", gear: "none",
    },
    shipTalks: [
      {
        lines: [
          "Every island out here is a page someone tried to tear out.",
          "I've spent twenty years reading the ones that survived.",
          "Keep sailing and we'll find the rest of them.",
        ],
      },
    ],
  },
  {
    id: "shipwright",
    name: "Franky",
    role: "Shipwright",
    color: "#2f8fbf",
    quip: "She's holding. Because I built her to hold.",
    look: {
      shirt: 0x2f8fbf, pants: 0x2f3a4a, skin: 0xd8a87e,
      hairColor: 0x5fc8e8, accent: 0xe8d24a,
      hat: "none", hair: "spiky", gear: "backpack", scale: 1.12,
    },
    shipTalks: [
      {
        lines: [
          "Show me the hull and I'll tell you what you hit and how fast.",
          "Nothing out here sinks a ship that's been looked after. Nothing.",
        ],
      },
    ],
  },
  {
    id: "musician",
    name: "Brook",
    role: "Musician",
    color: "#d8d0c0",
    quip: "A voyage without music is just damp travelling.",
    look: {
      shirt: 0x1f1f28, pants: 0x14141a, skin: 0xe8e4d8,
      hairColor: 0x2a2a34, accent: 0x9a3f5a,
      hat: "top", hair: "long", gear: "staff", scale: 1.18,
    },
    shipTalks: [
      {
        lines: [
          "I spent a very long time alone with only my own playing for company.",
          "You have no idea how much better it sounds with somebody listening.",
        ],
      },
    ],
  },
];

const BY_ID = new Map(CREW.map((c) => [c.id, c]));

export function crewById(id) {
  return BY_ID.get(id) || null;
}
