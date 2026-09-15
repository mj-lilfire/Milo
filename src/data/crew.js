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
      shirt: 0xe8e4d8, coat: 0x1f3a2c, pants: 0x22272e, skin: 0xe3b184,
      hairColor: 0x4f7a3a, accent: 0x2f7f4f, boots: 0x2a2620,
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
      shirt: 0xdfe6ee, pants: 0x35507e, skin: 0xefc09a,
      hairColor: 0xd9682a, accent: 0xc8523a, boots: 0x8a5a3a,
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
      shirt: 0xd8b23a, coat: 0x6f5030, pants: 0x5a4028, skin: 0xa97048,
      hairColor: 0x2a1d12, accent: 0xc9a227, boots: 0x4a3524,
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
      shirt: 0xf2f0ea, coat: 0x1c1c24, pants: 0x1a1a22, skin: 0xefc09a,
      hairColor: 0xe0c65e, accent: 0x14141a, boots: 0x14141a,
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
      shirt: 0xe8e2d4, coat: 0xc2493c, pants: 0x7a5236, skin: 0xd9a97f,
      hairColor: 0x8a5a3a, accent: 0xa83a30, boots: 0x5a3a26,
      hat: "antlers", hair: "short", gear: "backpack", scale: 0.66,
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
      shirt: 0x8fcfe6, pants: 0xe4ded0, skin: 0xefc09a,
      hairColor: 0x5f9fd4, accent: 0xd8d0c0, boots: 0xc8b89a,
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
      shirt: 0xd8cfc0, coat: 0x43304f, pants: 0x241d2b, skin: 0xd8a87e,
      hairColor: 0x2a1d18, accent: 0x8a6a3a, boots: 0x241d2b,
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
      shirt: 0xe4e0d4, coat: 0x2779a4, pants: 0x2f3a4a, skin: 0xd8a87e,
      hairColor: 0x53bfe0, accent: 0xe8d24a, boots: 0x22282f,
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
      shirt: 0xe0dcd2, coat: 0x191922, pants: 0x14141a, skin: 0xe8e4d8,
      hairColor: 0x2a2a34, accent: 0x8a2f4a, boots: 0x14141a,
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
