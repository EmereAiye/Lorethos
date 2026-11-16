// server.ts
import "dotenv/config";
import crypto2 from "node:crypto";
import fs2 from "node:fs/promises";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import JSZip from "jszip";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// server/db.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

// server/catalog.ts
var AUTHORITATIVE_STORIES = [
  {
    id: "story-obsidian-throne",
    slug: "the-obsidian-throne",
    title: "The Obsidian Throne",
    subtitle: "An Epic Dark Fantasy of Sovereignty, Ash, and Royal Reckoning",
    author: "Elara Kavanagh",
    authorBio: "Fabulist and folklorist exploring dynastic mythologies and high-court political intrigue.",
    genre: "Epic Fantasy",
    tags: ["Dark Fantasy", "Monarchy", "Ancient Magic", "Political Intrigue"],
    coverImage: "/assets/images/book_cover_obsidian_throne_1794465561565.jpg",
    synopsis: "When the High Citadels of Ostraka crumble under the shadow of the Black Eclipse, King Vane must summon an ancient blood-pact bound to the Obsidian Throne. Betrayal lurks behind velvet banners, and each decree carves a deeper fracture in the realm.",
    prologueLore: "Before the nine pillars fell, there existed only the Primordial Hearth. The kings of the First Spire forged their crowns not of gold, but of quenched astral glass plucked from the crater of Mount Veridia.",
    status: "Ongoing",
    accessTier: "subscription",
    priceNgn: 2800,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 5,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 1,
    updatedAt: "Oct 2026",
    chapters: [
      {
        id: "ch-obsidian-1",
        storyId: "story-obsidian-throne",
        chapterNumber: 1,
        title: "The Eclipse Over Ostraka",
        slug: "the-eclipse-over-ostraka",
        releaseDate: "Oct 14, 2026",
        wordCount: 2450,
        readTimeMinutes: 9,
        isFree: true,
        excerpt: "The bells of the High Scriptorium tolled seven minutes before noon, not to signal prayer, but to herald the dying of the sun.",
        content: [
          "The bells of the High Scriptorium tolled seven minutes before noon, not to signal prayer, but to herald the dying of the sun.",
          "High above the obsidian ramparts, King Vane stood draped in mantle of boiled stag-hide and hammered bronze. The wind whipping across the northern steppes carried the bitter scent of sulfur and wet granite. Below, ten thousand silent citizens watched the sky curdle into violet dusk.",
          '"Your Grace," whispered Chancellor Morwen, his hand trembling as he tucked a ceremonial parchment into his silk sashes. "The astrologers swear the celestial ring is passing directly through the Fourth House. If the ward stones ignite tonight, the lower garrison will drown in violet flame."',
          "Vane did not turn. His gaze remained locked on the blackened disc consuming the solar corona. A solitary ring of blinding golden embers remained, suspended like a crown of thorns above the shattered continent.",
          '"Let the lower gates remain open," Vane commanded, his voice measured, hollowed by three decades of quiet wars. "If the ancient pact demands a tithe, let the heavens look upon men who refuse to kneel in the dark."',
          "A murmur rippled along the battlements. Far below, in the sunken sanctuaries beneath the foundation stones, the first hymn began to rise\u2014a guttural, primordial chant passed down from ancestors who walked before the stars had names."
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-obsidian-2",
        storyId: "story-obsidian-throne",
        chapterNumber: 2,
        title: "The Scribe of the Lower Vault",
        slug: "the-scribe-of-the-lower-vault",
        releaseDate: "Oct 21, 2026",
        wordCount: 3100,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: "In the ink-stained catacombs beneath Ostraka, records were kept of things that the Citadel chose to forget.",
        content: [
          "In the ink-stained catacombs beneath Ostraka, records were kept of things that the Citadel chose to forget.",
          "Lady Sylva wiped charcoal dust from her knuckles and peered down at the clay tablet resting on her walnut lectern. The cuneiform indentations were still warm to the touch, vibrating with a low harmonic thrum that rattled the amber oil lamps.",
          '"They told us the Obsidian King died without heir three centuries ago," she murmured to the apprentice waiting in the shadows of the arched colonnade.',
          '"And yet," the youth whispered back, his breath misting in the cold subterranean draft, "the royal crest on the western gate is weeping fresh pine resin. The wood remembers who carved it."',
          "Sylva traced the carved contour of an interlocking monogram: the LT sigil, mark of the First Weavers. Legends warned that when the sigil breathed anew, the boundary between mortal ambition and mythological destiny would dissolve like dew upon a heated blade."
        ],
        ambientSoundscape: "rain"
      },
      {
        id: "ch-obsidian-3",
        storyId: "story-obsidian-throne",
        chapterNumber: 3,
        title: "The Iron Covenant",
        slug: "the-iron-covenant",
        releaseDate: "Oct 28, 2026",
        wordCount: 2890,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "Twelve warlords arrived by midnight, each bearing a jar of soil dug from the border of their ancestral lands.",
        content: [
          "Twelve warlords arrived by midnight, each bearing a jar of soil dug from the border of their ancestral lands.",
          "The Great Hall was cold despite the roaring hearths. Banners of faded vermilion and soot-black velvet hung from rafters carved in the likeness of sleeping serpents.",
          '"We did not ride through the salt flats to swear fealty to an empty chair," declared Lord Kaelen, slamming a clay vessel onto the basalt table until the loam spilled across the polished stone.',
          "Vane stepped out from behind the dais shadows. He wore no crown, only a torque of coiled iron about his collarbone.",
          '"The chair is not empty, Kaelen," the King replied softly. "You simply cannot see the ghosts that occupy it."'
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-obsidian-4",
        storyId: "story-obsidian-throne",
        chapterNumber: 4,
        title: "The Trial of Ashen Waters",
        slug: "the-trial-of-ashen-waters",
        releaseDate: "Nov 04, 2026",
        wordCount: 3400,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: "The deep subterranean lake gave off a phosphorescent mist, shimmering with the memories of those who dared drink from its basin.",
        content: [
          "The deep subterranean lake gave off a phosphorescent mist, shimmering with the memories of those who dared drink from its basin.",
          "To pass the Fourth Gate, one must surrender the memory that hurts the most. Sylva stood at the edge of the glassy pool, feeling the chill seeping through the soles of her riding boots.",
          'Vane raised the ceremonial obsidian ladle. "Once consumed, there is no weeping for what has been excised. You will remember the name of your child, but not the sound of her laugh."',
          "Sylva stepped forward into the shallows without hesitation."
        ],
        ambientSoundscape: "mythic_drone"
      },
      {
        id: "ch-obsidian-5",
        storyId: "story-obsidian-throne",
        chapterNumber: 5,
        title: "Whispers Beneath the Dais",
        slug: "whispers-beneath-the-dais",
        releaseDate: "Nov 11, 2026",
        wordCount: 3200,
        readTimeMinutes: 11,
        isFree: false,
        excerpt: "A silent coup does not begin with poisoned chalices, but with rewritten histories.",
        content: [
          "A silent coup does not begin with poisoned chalices, but with rewritten histories.",
          "In the dead of night, the scribes worked under guard, scraping parchment with razor horn to substitute names of fallen houses with those favored by the regent council.",
          "When dawn broke, three families no longer legally existed."
        ]
      }
    ]
  },
  {
    id: "story-whispering-savanna",
    slug: "whisper-of-the-baobab",
    title: "Whisper of the Baobab",
    subtitle: "Mythological Realism, Astral Nomads, and the Starlit Desert",
    author: "Ama Achebe",
    authorBio: "Novelist and mythological scholar based between Nigeria and Oxford, exploring West African folklore, astral navigation, and speculative ancestral wisdom.",
    genre: "Mythological Realism",
    tags: ["Afrofuturism", "Ancestral Lore", "Folklore", "Cosmic Journey"],
    coverImage: "/assets/images/book_cover_whispering_savanna_1794465562207.jpg",
    synopsis: "Under the cosmic expanse of the Sahel night, young navigator Boma is chosen to carry the ancestral seed across the singing sands. When the ancient Baobab tree illuminates with celestial runes, she discovers her ancestors did not merely observe the stars\u2014they built highways between them.",
    prologueLore: "In the beginning, when the earth was red clay drying under the midday breath of Olorun, the first grandmother planted her brass hairpin into the cracked mud. By sundown, it had grown roots of thunder and branches of indigo sky.",
    status: "Ongoing",
    accessTier: "subscription",
    priceNgn: 2500,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 2,
    updatedAt: "Sep 2026",
    chapters: [
      {
        id: "ch-baobab-1",
        storyId: "story-whispering-savanna",
        chapterNumber: 1,
        title: "The Brass Compass of Azar",
        slug: "the-brass-compass-of-azar",
        releaseDate: "Sep 05, 2026",
        wordCount: 2800,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "The compass did not point north; it pointed toward the nearest place where a living ancestor had drawn their final breath.",
        content: [
          "The compass did not point north; it pointed toward the nearest place where a living ancestor had drawn their final breath.",
          "Boma held the instrument cupped in both palms. The brass casing was cool against her feverish skin, inscribed with intricate knotwork reminiscent of ancient terracotta vessels unearthed along the Niger riverbanks.",
          "Behind her, the village of Kundi was already folding up its indigo canopies. The elder caravan leaders spoke in low, hushed tones, eyeing the southern horizon where the dunes were glowing with a strange opalescent luminescence.",
          '"The baobab has spoken thrice this moon," Elder Tari said, limping to her side with his carved mahogany staff. "The first time it whispered of droughts. The second time it wept salt. But tonight... tonight its trunk shines with the script of the Sky People."',
          "Boma looked up at the colossal tree towering at the center of the desert basin. Its trunk, wider than twenty men with arms outstretched, was veined with pale cobalt light, pulsing in rhythm with her own heartbeat."
        ],
        ambientSoundscape: "mythic_drone"
      },
      {
        id: "ch-baobab-2",
        storyId: "story-whispering-savanna",
        chapterNumber: 2,
        title: "The Singing Sands of Kundi",
        slug: "the-singing-sands-of-kundi",
        releaseDate: "Sep 12, 2026",
        wordCount: 3100,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: "When the wind rises between the crests of the red dunes, the sand hums in five distinct polyrhythms.",
        content: [
          "When the wind rises between the crests of the red dunes, the sand hums in five distinct polyrhythms.",
          "Boma walked with her feet bare against the cool evening crust. Each step sent subtle ripples of silver light through the grains, like phosphorus stirred in a tropical lagoon.",
          `"Walk with the tempo of your grandmother's loom," Elder Tari had instructed her before she crossed the village boundary stone. "If you hurry, the desert thinks you are fleeing, and it swallows what runs."`,
          "In the distance, three twin moons hung in a serene celestial triangle, reflecting off the salt flats like dropped coins of silver."
        ],
        ambientSoundscape: "rain"
      },
      {
        id: "ch-baobab-3",
        storyId: "story-whispering-savanna",
        chapterNumber: 3,
        title: "Runes of the First Weavers",
        slug: "runes-of-the-first-weavers",
        releaseDate: "Sep 19, 2026",
        wordCount: 2950,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "Touching the bark felt like pressing one's ear against a sleeping giant's ribcage.",
        content: [
          "Touching the bark felt like pressing one's ear against a sleeping giant's ribcage.",
          "The runes glowed brighter beneath Boma's fingertips, spiraling upward along the gnarled bark into the crown of stars.",
          'Words formed not in the air, but inside the marrow of her bones: "Return what was stolen before the dry season closes the throat of the sky."'
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-baobab-4",
        storyId: "story-whispering-savanna",
        chapterNumber: 4,
        title: "The Starlit Oasis",
        slug: "the-starlit-oasis",
        releaseDate: "Sep 26, 2026",
        wordCount: 3300,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: "Deep in the forbidden hollow, the water did not reflect the sky above, but the sky on the opposite hemisphere of the world.",
        content: [
          "Deep in the forbidden hollow, the water did not reflect the sky above, but the sky on the opposite hemisphere of the world.",
          "Boma knelt at the water's edge. Constellations she had never seen before floated beneath the lily pads, turning slowly in a dark aquatic vortex.",
          'A voice like rustling dry palm fronds spoke from the shadow of the acacia: "You have arrived earlier than your mother did."'
        ]
      }
    ]
  },
  {
    id: "story-sunken-epoch",
    slug: "chronicles-of-the-sunken-epoch",
    title: "Chronicles of the Sunken Epoch",
    subtitle: "Sunken Citadels, Lost Archeology, and the Relics of the Deep",
    author: "Elara Vance",
    authorBio: "Maritime archaeologist and speculative fiction author whose work combines deep-sea oceanography with ancient forgotten civilizations.",
    genre: "Lost Epoch & Sci-Fi",
    tags: ["Submerged Worlds", "Ancient Relics", "Ocean Mythos", "Archaeology"],
    coverImage: "/assets/images/book_cover_sunken_epoch_1794465563519.jpg",
    synopsis: "Miles beneath the crashing storms of the Cerulean Trench lies Atal-Mor, a submerged metropolis preserved in a glowing abyssal bubble. Diver Captain Kaelen uncovers an ornate golden reliquary containing the living memory of a drowned world\u2014and the warning that the ocean is rising again.",
    prologueLore: "The waters did not take Atal-Mor out of wrath. They took it out of longing. When humanity turned its eyes solely toward fire and iron, the oceans rose to cradle the temples of philosophy in perpetual blue repose.",
    status: "Completed",
    accessTier: "purchase",
    priceNgn: 3200,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 3,
    updatedAt: "Jul 2026",
    chapters: [
      {
        id: "ch-sunken-1",
        storyId: "story-sunken-epoch",
        chapterNumber: 1,
        title: "Descent into the Cerulean Trench",
        slug: "descent-into-the-cerulean-trench",
        releaseDate: "Jul 10, 2026",
        wordCount: 3200,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: "At four thousand fathoms, darkness is not the absence of light; it is a heavy living fabric that presses against your dive-suit glass.",
        content: [
          "At four thousand fathoms, darkness is not the absence of light; it is a heavy living fabric that presses against your dive-suit glass.",
          "Kaelen watched the depth gauge spin past the danger threshold. The brass dial on his forearm hissed as pneumatic seals adjusted to the crushing pressure.",
          "Then, suddenly, the hull lights of his dive vessel caught a gleam of polished marble.",
          "Colossal statues of crowned deities, thirty meters tall, stood in silent procession along an underwater avenue. Between them swam schools of glowing lantern fish, darting like sparks through the sunken colonnades of Atal-Mor."
        ],
        ambientSoundscape: "rain"
      },
      {
        id: "ch-sunken-2",
        storyId: "story-sunken-epoch",
        chapterNumber: 2,
        title: "The Reliquary of Living Light",
        slug: "the-reliquary-of-living-light",
        releaseDate: "Jul 17, 2026",
        wordCount: 2900,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "The golden casket rested upon a pedestal of carved sea-serpents, untouched by barnacles or marine decay.",
        content: [
          "The golden casket rested upon a pedestal of carved sea-serpents, untouched by barnacles or marine decay.",
          "When Kaelen's gloved hand brushed the latch, the reliquary opened of its own accord. A warm, golden luminescence bloomed outward, banishing the abyssal chill.",
          "Within the velvet interior lay an egg of carved amber, rotating without wire or pivot, projecting holographic scripts of an ancient alphabet into the water."
        ]
      },
      {
        id: "ch-sunken-3",
        storyId: "story-sunken-epoch",
        chapterNumber: 3,
        title: "Voices of the Drowned Council",
        slug: "voices-of-the-drowned-council",
        releaseDate: "Jul 24, 2026",
        wordCount: 3050,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: "The amber spoke not in sound waves, but directly into the sonar receiver of his helmet.",
        content: [
          "The amber spoke not in sound waves, but directly into the sonar receiver of his helmet.",
          '"We who slumber in the deep do not ask for salvation," the chorus resonated. "We ask only that you do not repeat the arrogance of the sun-kings who burned the sky."'
        ]
      },
      {
        id: "ch-sunken-4",
        storyId: "story-sunken-epoch",
        chapterNumber: 4,
        title: "Breach in the Pressure Dome",
        slug: "breach-in-the-pressure-dome",
        releaseDate: "Jul 31, 2026",
        wordCount: 3500,
        readTimeMinutes: 13,
        isFree: false,
        excerpt: "A hairline fracture appeared in the atmospheric crystal keeping the central library dry for three millennia.",
        content: [
          "A hairline fracture appeared in the atmospheric crystal keeping the central library dry for three millennia.",
          "Water droplets struck the ancient dry scrolls with the finality of rifle shots."
        ]
      }
    ]
  },
  {
    id: "story-crimson-scribe",
    slug: "the-crimson-scribe",
    title: "The Crimson Scribe",
    subtitle: "Palace Intrigue, Secret Manuscripts, and the Poisoned Quills of Veritas",
    author: "Evelyn St. Claire",
    authorBio: "Historian and novelist specializing in Renaissance cryptography, clandestine manuscripts, and the secret diplomacy of sovereign courts.",
    genre: "Historical Mystery",
    tags: ["Palace Mystery", "Manuscripts", "Secret Societies", "Renaissance Noir"],
    coverImage: "/assets/images/book_cover_crimson_dynasty_1794465562273.jpg",
    synopsis: "In the grand royal scriptorium of House Valerius, every royal decree is written in red squid ink. But when apprentice copyist Lucien discovers a parchment with an encrypted ledger hidden between illuminated vellum pages, he realizes the last three kings were not assassinated by neighboring empires\u2014they were executed by their own royal scribes.",
    prologueLore: "The ink never lies, but the scribe may dip his quill in poison as easily as in gall. In Veritas, power resides not with the prince who speaks, but with the quiet clerk who transcribes his words for posterity.",
    status: "Ongoing",
    accessTier: "subscription",
    priceNgn: 2200,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 4,
    updatedAt: "Sep 2026",
    chapters: [
      {
        id: "ch-scribe-1",
        storyId: "story-crimson-scribe",
        chapterNumber: 1,
        title: "The Gall of House Valerius",
        slug: "the-gall-of-house-valerius",
        releaseDate: "Aug 14, 2026",
        wordCount: 2600,
        readTimeMinutes: 9,
        isFree: true,
        excerpt: "To mix the royal red ink, one must boil crushed cochineal beetles with aged vinegar and iron salts until the fumes burn the throat.",
        content: [
          "To mix the royal red ink, one must boil crushed cochineal beetles with aged vinegar and iron salts until the fumes burn the throat.",
          "Lucien stirred the copper cauldron with a cedar dowel, watching the liquid transition from rust to brilliant arterial crimson.",
          "The scriptorium was silent except for the rhythmic scratching of thirty goose-quill pens on calfskin vellum. Outside the high arched stained-glass windows, rain swept across the slate roofs of the capital.",
          `"Master Corvin," Lucien whispered, stepping toward the chief archivist's mahogany desk. "The missive from the Duke of Morveau contains a date that contradicts the treaty signed last winter."`,
          'Corvin looked up slowly, his cataract-clouded eyes narrowing. "In this room, Lucien, dates are not facts. Dates are instruments of statecraft. Copy what is written, or let the ink find another hand."'
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-scribe-2",
        storyId: "story-crimson-scribe",
        chapterNumber: 2,
        title: "Cipher in the Margins",
        slug: "cipher-in-the-margins",
        releaseDate: "Aug 21, 2026",
        wordCount: 2900,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "Microscopic punctures along the floral border of the Psalms formed a grid of coordinates.",
        content: [
          "Microscopic punctures along the floral border of the Psalms formed a grid of coordinates.",
          "Lucien held the leaf against the candle flame. The pinpricks glowed like stars in a miniature constellation, aligning precisely with the names of the five royal tasters."
        ]
      },
      {
        id: "ch-scribe-3",
        storyId: "story-crimson-scribe",
        chapterNumber: 3,
        title: "The Archivist's Last Will",
        slug: "the-archivists-last-will",
        releaseDate: "Aug 28, 2026",
        wordCount: 2750,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: "Corvin was found slumped over his desk at dawn, his lips stained with the very ink he had guarded for fifty years.",
        content: [
          "Corvin was found slumped over his desk at dawn, his lips stained with the very ink he had guarded for fifty years.",
          "In his stiffened fingers, he clutched a wax seal depicting the Lorethos double-headed quill."
        ]
      },
      {
        id: "ch-scribe-4",
        storyId: "story-crimson-scribe",
        chapterNumber: 4,
        title: "The Night of the Silent Wax",
        slug: "the-night-of-the-silent-wax",
        releaseDate: "Sep 04, 2026",
        wordCount: 3300,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: "Every door in the scriptorium was bolted from the outside as footsteps echoed along the flagstones.",
        content: [
          "Every door in the scriptorium was bolted from the outside as footsteps echoed along the flagstones.",
          "Lucien hid inside the secret recess behind the theological treatises, breathing through his teeth as armed men with lanterns searched the desks."
        ]
      }
    ]
  }
];
function sanitizeStoryForPublic(story) {
  return {
    ...story,
    totalChapters: story.chapters.length,
    chapters: story.chapters.map((ch) => ({
      ...ch,
      // Never leak paid chapter prose to unauthenticated public catalog responses
      content: ch.isFree ? ch.content : []
    }))
  };
}

// server/db.ts
var PLAN_PRICES_NGN = {
  monthly: { amountNgn: 3500, label: "Patron Monthly Subscription" },
  annual: { amountNgn: 32e3, label: "Patron Annual Subscription (12 Months)" }
};
var OWNER_EMAIL = (process.env.OWNER_EMAIL || "Emmymasterwise@gmail.com").trim().toLowerCase();
var STATE_FILE = process.env.LORETHOS_DATA_FILE || "/tmp/lorethos-server-state.json";
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
function buildDefaultReadingGoal() {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = /* @__PURE__ */ new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    frequency: "daily",
    targetChapters: 2,
    currentProgress: 0,
    streakDays: 0,
    bestStreakDays: 0,
    lastUpdatedDate: iso(now),
    completedChapterIds: [],
    history: Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - idx));
      return {
        dayName: dayNames[d.getDay()],
        dateStr: `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`,
        dateIso: iso(d),
        chaptersRead: 0,
        metTarget: false
      };
    })
  };
}
var LorethosRepository = class {
  constructor() {
    this.pool = null;
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 1e4
      });
      this.pool.on("error", (err) => {
        console.error("PostgreSQL pool error:", err);
      });
    }
    this.state = this.loadInitialSnapshot();
  }
  loadInitialSnapshot() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        if (Array.isArray(parsed.stories) && parsed.stories.length > 0) {
          return parsed;
        }
      }
    } catch {
    }
    return {
      users: [],
      stories: AUTHORITATIVE_STORIES.map((s) => ({ ...s, totalChapters: s.chapters.length })),
      orders: [],
      processedEventIds: [],
      highlights: {},
      comments: [],
      inquiries: []
    };
  }
  persistSnapshot() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {
    }
  }
  isPostgresEnabled() {
    return this.pool !== null;
  }
  async checkDatabaseHealth() {
    if (!this.pool) return "local-store";
    try {
      await this.pool.query("SELECT 1");
      return "postgres";
    } catch {
      return "local-store";
    }
  }
  toPublicProfile(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      unlockedStoryIds: user.unlockedStoryIds,
      bookmarkedChapterIds: user.bookmarkedChapterIds,
      readingProgress: user.readingProgress,
      readingGoal: user.readingGoal
    };
  }
  getUserById(userId) {
    return this.state.users.find((u) => u.id === userId);
  }
  getUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === normalized);
  }
  async createUser(name, email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const isOwner = normalizedEmail === OWNER_EMAIL;
    const record = {
      id: `usr_${crypto.randomUUID()}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: isOwner ? "owner" : "reader",
      subscription: { plan: "free", status: "none", amountNgn: 0 },
      unlockedStoryIds: [],
      bookmarkedChapterIds: [],
      readingProgress: {},
      readingGoal: buildDefaultReadingGoal(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.users.push(record);
    this.persistSnapshot();
    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (email) DO NOTHING`,
          [record.id, record.name, record.email, record.passwordHash, record.role]
        );
      } catch (err) {
        console.error("Failed to mirror user into PostgreSQL:", err);
      }
    }
    return record;
  }
  getStories() {
    return this.state.stories.map((s) => ({
      ...s,
      totalChapters: s.chapters.length
    }));
  }
  getStoryBySlug(slug) {
    const story = this.state.stories.find((s) => s.slug === slug);
    return story ? { ...story, totalChapters: story.chapters.length } : void 0;
  }
  getStoryById(storyId) {
    const story = this.state.stories.find((s) => s.id === storyId);
    return story ? { ...story, totalChapters: story.chapters.length } : void 0;
  }
  hasAccessToChapter(user, story, chapter) {
    if (chapter.isFree || story.accessTier === "free") return true;
    if (!user) return false;
    if (user.role === "owner") return true;
    if (user.subscription.status === "active" && story.accessTier === "subscription") return true;
    if (user.unlockedStoryIds.includes(story.id)) return true;
    return false;
  }
  addStory(input) {
    const baseSlug = input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = this.state.stories.some((s) => s.slug === baseSlug) ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    const id = `story-${Date.now()}`;
    const newStory = {
      ...input,
      id,
      slug,
      rating: 0,
      ratingsCount: 0,
      totalReads: 0,
      totalChapters: 1,
      chapters: [
        {
          id: `ch-${Date.now()}-1`,
          storyId: id,
          chapterNumber: 1,
          title: "Chapter 1: Opening",
          slug: "chapter-1-opening",
          releaseDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          wordCount: 350,
          readTimeMinutes: 2,
          isFree: true,
          excerpt: "Opening chapter draft.",
          content: ["Begin writing this series in the chapter studio."]
        }
      ]
    };
    this.state.stories.unshift(newStory);
    this.persistSnapshot();
    return newStory;
  }
  addChapterToStory(storyId, chapterData) {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    const newChapter = {
      ...chapterData,
      id: `ch-${Date.now()}`,
      storyId
    };
    story.chapters.push(newChapter);
    story.totalChapters = story.chapters.length;
    story.updatedAt = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    this.persistSnapshot();
    return newChapter;
  }
  updateStoryPricing(storyId, tier, priceNgn, freeChaptersCount) {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    story.accessTier = tier;
    story.priceNgn = Math.max(0, Math.round(priceNgn));
    story.freeChaptersCount = Math.max(0, Math.round(freeChaptersCount));
    story.chapters = story.chapters.map((ch, idx) => ({
      ...ch,
      isFree: tier === "free" ? true : idx < story.freeChaptersCount
    }));
    this.persistSnapshot();
    return story;
  }
  toggleBookmark(userId, chapterId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    const exists = user.bookmarkedChapterIds.includes(chapterId);
    user.bookmarkedChapterIds = exists ? user.bookmarkedChapterIds.filter((id) => id !== chapterId) : [...user.bookmarkedChapterIds, chapterId];
    this.persistSnapshot();
    return user.bookmarkedChapterIds;
  }
  recordProgress(userId, storyId, chapterId, chapterNumber, progressPercent) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.readingProgress[storyId] = {
      chapterId,
      chapterNumber,
      progressPercent: Math.min(100, Math.max(0, Math.round(progressPercent))),
      lastReadAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persistSnapshot();
    return user.readingProgress;
  }
  updateReadingGoal(userId, goal) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.readingGoal = goal;
    this.persistSnapshot();
    return user.readingGoal;
  }
  cancelSubscription(userId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.subscription = {
      ...user.subscription,
      status: "expired"
    };
    this.persistSnapshot();
    return user.subscription;
  }
  createOrder(params) {
    const reference = `lor_${crypto.randomBytes(6).toString("hex")}`;
    const order = {
      id: `ord_${crypto.randomUUID()}`,
      reference,
      userId: params.userId,
      customerEmail: params.customerEmail,
      itemType: params.itemType,
      planId: params.planId,
      storyId: params.storyId,
      itemName: params.itemName,
      amountNgn: params.amountNgn,
      currency: "NGN",
      channel: "hosted",
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.orders.unshift(order);
    this.persistSnapshot();
    return order;
  }
  getOrderByReference(reference) {
    return this.state.orders.find((o) => o.reference === reference);
  }
  fulfillOrderIdempotently(reference, paidAmountKobo, currency, channel, eventId) {
    if (eventId && this.state.processedEventIds.includes(eventId)) {
      const existing = this.getOrderByReference(reference);
      return { ok: true, order: existing };
    }
    const order = this.getOrderByReference(reference);
    if (!order) {
      return { ok: false, reason: "Order reference not found." };
    }
    if (currency.toUpperCase() !== order.currency || paidAmountKobo < order.amountNgn * 100) {
      order.status = "failed";
      this.persistSnapshot();
      return { ok: false, reason: "Amount or currency mismatch." };
    }
    if (order.status === "success") {
      if (eventId) {
        this.state.processedEventIds.push(eventId);
        this.persistSnapshot();
      }
      return { ok: true, order };
    }
    const user = this.getUserById(order.userId);
    if (!user) {
      return { ok: false, reason: "Order owner account missing." };
    }
    if (order.itemType === "subscription") {
      const validUntil = /* @__PURE__ */ new Date();
      if (order.planId === "annual") {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      } else {
        validUntil.setMonth(validUntil.getMonth() + 1);
      }
      user.subscription = {
        plan: order.planId || "monthly",
        status: "active",
        amountNgn: order.amountNgn,
        validUntil: validUntil.toISOString(),
        renewsAt: validUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      };
    } else if (order.itemType === "book_purchase" && order.storyId) {
      if (!user.unlockedStoryIds.includes(order.storyId)) {
        user.unlockedStoryIds.push(order.storyId);
      }
    }
    order.status = "success";
    order.channel = channel;
    order.fulfilledAt = (/* @__PURE__ */ new Date()).toISOString();
    if (eventId) {
      this.state.processedEventIds.push(eventId);
    }
    this.persistSnapshot();
    return { ok: true, order };
  }
  getUserTransactions(userId) {
    return this.state.orders.filter((o) => o.userId === userId).map((o) => ({
      id: o.id,
      reference: o.reference,
      customerEmail: o.customerEmail,
      amountNgn: o.amountNgn,
      itemType: o.itemType,
      itemName: o.itemName,
      itemId: o.storyId,
      channel: o.channel === "hosted" ? "card" : o.channel,
      status: o.status,
      date: o.createdAt
    }));
  }
  getAdminOverview() {
    const paidOrders = this.state.orders.filter((o) => o.status === "success");
    const grossRevenueNgn = paidOrders.reduce((sum, o) => sum + o.amountNgn, 0);
    const activeSubscribers = this.state.users.filter((u) => u.subscription.status === "active").length;
    return {
      grossRevenueNgn,
      activeSubscribers,
      totalRegisteredUsers: this.state.users.length,
      publishedStoriesCount: this.state.stories.length,
      publishedChaptersCount: this.state.stories.reduce((sum, s) => sum + s.chapters.length, 0),
      inquiries: this.state.inquiries,
      transactions: this.state.orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        customerEmail: o.customerEmail,
        amountNgn: o.amountNgn,
        itemType: o.itemType,
        itemName: o.itemName,
        itemId: o.storyId,
        channel: o.channel === "hosted" ? "card" : o.channel,
        status: o.status,
        date: o.createdAt
      }))
    };
  }
  getHighlights(userId) {
    return this.state.highlights[userId] || [];
  }
  saveHighlight(userId, highlight) {
    const existingList = this.state.highlights[userId] || [];
    const idx = existingList.findIndex(
      (h) => h.chapterId === highlight.chapterId && h.paragraphIndex === highlight.paragraphIndex
    );
    if (idx >= 0) {
      existingList[idx] = highlight;
    } else {
      existingList.unshift(highlight);
    }
    this.state.highlights[userId] = existingList;
    this.persistSnapshot();
    return existingList;
  }
  deleteHighlight(userId, highlightId) {
    const existingList = this.state.highlights[userId] || [];
    this.state.highlights[userId] = existingList.filter((h) => h.id !== highlightId);
    this.persistSnapshot();
    return this.state.highlights[userId];
  }
  getComments(chapterId) {
    if (!chapterId) return this.state.comments;
    return this.state.comments.filter((c) => c.chapterId === chapterId);
  }
  addComment(comment) {
    this.state.comments.unshift(comment);
    this.persistSnapshot();
    return comment;
  }
  deleteComment(commentId, authorName, isOwner) {
    const target = this.state.comments.find((c) => c.id === commentId);
    if (!target) return false;
    if (!isOwner && target.authorName !== authorName) return false;
    this.state.comments = this.state.comments.filter((c) => c.id !== commentId);
    this.persistSnapshot();
    return true;
  }
  addInquiry(inquiry) {
    this.state.inquiries.unshift(inquiry);
    this.persistSnapshot();
    return inquiry;
  }
};
var repo = new LorethosRepository();

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
var MODEL_NAME = "gemini-4-hydrogen";
var SESSION_COOKIE_NAME = "lorethos_session";
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var EPHEMERAL_DEV_SECRET = crypto2.randomBytes(32).toString("hex");
function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.warn("WARNING: SESSION_SECRET is not set in production; using ephemeral secret.");
  }
  return EPHEMERAL_DEV_SECRET;
}
function createRateLimiter(maxRequests, windowMs) {
  const buckets = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (buckets.get(key) || []).filter((ts) => ts > cutoff);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please slow down and try again shortly." });
      return;
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    next();
  };
}
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const result = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}
function signSessionToken(userId) {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto2.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto2.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto2.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.uid;
  } catch {
    return null;
  }
}
function setSessionCookie(req, res, userId) {
  const token = signSessionToken(userId);
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`
  ];
  if (isHttps && process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}
function getAuthenticatedUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (!userId) return void 0;
  return repo.getUserById(userId);
}
function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required. Please sign in to continue." });
    return;
  }
  req.currentUser = user;
  next();
}
function requireOwner(req, res, next) {
  const user = req.currentUser || getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (user.role !== "owner") {
    res.status(403).json({ error: "Owner authorization required for Publishing Desk access." });
    return;
  }
  req.currentUser = user;
  next();
}
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function withTimeout(promise, timeoutMs = 25e3) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error("Request timed out after 25 seconds.")), timeoutMs)
    )
  ]);
}
function formatGeminiError(err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes("GEMINI_API_KEY is not configured")) {
    return {
      status: 503,
      message: "AI features are unavailable because the server Gemini key is not configured."
    };
  }
  if (rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 502,
      message: "AI provider denied the request. Please try again later."
    };
  }
  if (rawMessage.includes("400") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 502,
      message: "AI service configuration rejected the request."
    };
  }
  if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "AI rate limit reached. Please wait a moment and try again."
    };
  }
  if (rawMessage.includes("timed out")) {
    return {
      status: 504,
      message: "The AI service took too long to respond. Please try again."
    };
  }
  return {
    status: 500,
    message: "Failed to generate AI response. Please try again."
  };
}
function mapPaystackChannel(channel) {
  const c = String(channel || "").toLowerCase();
  if (c === "bank_transfer" || c === "bank" || c === "dedicated_nuban") return "bank_transfer";
  if (c === "ussd") return "ussd";
  return "card";
}
async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const aiLimiter = createRateLimiter(20, 6e4);
  const authLimiter = createRateLimiter(25, 6e4);
  const inquiryLimiter = createRateLimiter(10, 6e4);
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        res.status(503).json({ error: "Paystack webhook secret not configured." });
        return;
      }
      const signature = req.headers["x-paystack-signature"];
      if (typeof signature !== "string" || !signature) {
        res.status(401).json({ error: "Missing Paystack signature." });
        return;
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || ""));
      const computedHash = crypto2.createHmac("sha512", secret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature, "utf8");
      const expectedBuf = Buffer.from(computedHash, "utf8");
      if (sigBuf.length !== expectedBuf.length || !crypto2.timingSafeEqual(sigBuf, expectedBuf)) {
        res.status(401).json({ error: "Invalid Paystack signature." });
        return;
      }
      try {
        const event = JSON.parse(rawBody.toString("utf8"));
        if (event.event === "charge.success" && event.data?.reference) {
          const eventId = String(event.id ?? event.data.id ?? event.data.reference);
          repo.fulfillOrderIdempotently(
            event.data.reference,
            Number(event.data.amount || 0),
            String(event.data.currency || "NGN"),
            mapPaystackChannel(event.data.channel),
            eventId
          );
        }
        res.status(200).json({ received: true });
      } catch {
        res.status(400).json({ error: "Malformed webhook payload." });
      }
    }
  );
  app.use(express.json({ limit: "2mb" }));
  app.get("/api/health", async (_req, res) => {
    const db = await repo.checkDatabaseHealth();
    res.json({
      ok: true,
      db,
      paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/auth/session", (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: repo.toPublicProfile(user) });
  });
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name, email, password } = req.body;
    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();
    const rawPassword = String(password || "");
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      res.status(400).json({ error: "Name must be between 2 and 80 characters." });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      res.status(400).json({ error: "Password must be at least 8 characters long." });
      return;
    }
    if (repo.getUserByEmail(trimmedEmail)) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in." });
      return;
    }
    const user = await repo.createUser(trimmedName, trimmedEmail, rawPassword);
    setSessionCookie(req, res, user.id);
    res.status(201).json({ user: repo.toPublicProfile(user) });
  });
  app.post("/api/auth/login", authLimiter, (req, res) => {
    const { email, password } = req.body;
    const trimmedEmail = (email || "").trim().toLowerCase();
    const rawPassword = String(password || "");
    if (!EMAIL_REGEX.test(trimmedEmail) || !rawPassword) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    const user = repo.getUserByEmail(trimmedEmail);
    if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    setSessionCookie(req, res, user.id);
    res.json({ user: repo.toPublicProfile(user) });
  });
  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app.get("/api/stories", (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const genre = String(req.query.genre || "All").trim();
    const status = String(req.query.status || "All").trim();
    const tier = String(req.query.tier || "All").trim();
    const sort = String(req.query.sort || "popular").trim();
    let stories = repo.getStories().map(sanitizeStoryForPublic);
    stories = stories.filter((story) => {
      const matchesSearch = !q || story.title.toLowerCase().includes(q) || story.subtitle.toLowerCase().includes(q) || story.author.toLowerCase().includes(q) || story.synopsis.toLowerCase().includes(q) || story.tags.some((t) => t.toLowerCase().includes(q));
      const matchesGenre = genre === "All" || story.genre === genre;
      const matchesStatus = status === "All" || story.status === status;
      const matchesTier = tier === "All" || tier === "Free" && story.accessTier === "free" || tier === "Subscription" && story.accessTier === "subscription" || tier === "Purchase" && story.accessTier === "purchase";
      return matchesSearch && matchesGenre && matchesStatus && matchesTier;
    });
    stories.sort((a, b) => {
      if (sort === "chapters") return b.chapters.length - a.chapters.length;
      if (sort === "rating") return b.rating - a.rating;
      return (a.spotlightOrder ?? 99) - (b.spotlightOrder ?? 99);
    });
    res.json({ stories });
  });
  app.get("/api/stories/:slug", (req, res) => {
    const story = repo.getStoryBySlug(req.params.slug);
    if (!story) {
      res.status(404).json({ error: "Story not found." });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(story) });
  });
  app.get("/api/stories/:slug/chapters/:chapterNumber", (req, res) => {
    const story = repo.getStoryBySlug(req.params.slug);
    if (!story) {
      res.status(404).json({ error: "Story not found." });
      return;
    }
    const chNum = Number(req.params.chapterNumber);
    const chapter = story.chapters.find((c) => c.chapterNumber === chNum);
    if (!chapter) {
      res.status(404).json({ error: "Chapter not found." });
      return;
    }
    const user = getAuthenticatedUser(req);
    const allowed = repo.hasAccessToChapter(user, story, chapter);
    if (!allowed) {
      res.status(403).json({
        locked: true,
        error: "This chapter requires an active Patron membership or individual story unlock.",
        story: sanitizeStoryForPublic(story),
        chapter: {
          ...chapter,
          content: []
        }
      });
      return;
    }
    res.json({
      locked: false,
      story: sanitizeStoryForPublic(story),
      chapter
    });
  });
  app.get("/api/account/transactions", requireAuth, (req, res) => {
    res.json({ transactions: repo.getUserTransactions(req.currentUser.id) });
  });
  app.post("/api/account/bookmarks/toggle", requireAuth, (req, res) => {
    const { chapterId } = req.body;
    if (!chapterId) {
      res.status(400).json({ error: "chapterId is required." });
      return;
    }
    const updated = repo.toggleBookmark(req.currentUser.id, chapterId);
    res.json({ bookmarkedChapterIds: updated || [] });
  });
  app.put("/api/account/progress", requireAuth, (req, res) => {
    const { storyId, chapterId, chapterNumber, progressPercent } = req.body;
    if (!storyId || !chapterId || !Number.isFinite(chapterNumber)) {
      res.status(400).json({ error: "Valid reading progress fields are required." });
      return;
    }
    const updated = repo.recordProgress(
      req.currentUser.id,
      storyId,
      chapterId,
      Number(chapterNumber),
      Number(progressPercent || 0)
    );
    res.json({ readingProgress: updated || {} });
  });
  app.put("/api/account/goal", requireAuth, (req, res) => {
    const { readingGoal } = req.body;
    if (!readingGoal || !Number.isFinite(readingGoal.targetChapters)) {
      res.status(400).json({ error: "Valid readingGoal payload is required." });
      return;
    }
    const updated = repo.updateReadingGoal(req.currentUser.id, readingGoal);
    res.json({ readingGoal: updated });
  });
  app.post("/api/account/subscription/cancel", requireAuth, (req, res) => {
    const updated = repo.cancelSubscription(req.currentUser.id);
    res.json({ subscription: updated });
  });
  app.get("/api/account/highlights", requireAuth, (req, res) => {
    res.json({ highlights: repo.getHighlights(req.currentUser.id) });
  });
  app.post("/api/account/highlights", requireAuth, (req, res) => {
    const body = req.body;
    if (!body.storyId || !body.chapterId || typeof body.paragraphIndex !== "number" || !body.excerpt) {
      res.status(400).json({ error: "Invalid highlight payload." });
      return;
    }
    const highlights = repo.saveHighlight(req.currentUser.id, {
      id: body.id || `hl_${crypto2.randomUUID()}`,
      storyId: body.storyId,
      storyTitle: String(body.storyTitle || "").slice(0, 120),
      storySlug: String(body.storySlug || "").slice(0, 120),
      chapterId: body.chapterId,
      chapterNumber: Number(body.chapterNumber || 1),
      chapterTitle: String(body.chapterTitle || "").slice(0, 160),
      paragraphIndex: body.paragraphIndex,
      excerpt: String(body.excerpt).slice(0, 1200),
      color: ["terracotta", "gold", "sage"].includes(String(body.color)) ? body.color : "terracotta",
      note: body.note ? String(body.note).slice(0, 600) : void 0,
      createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    });
    res.json({ highlights });
  });
  app.delete("/api/account/highlights/:id", requireAuth, (req, res) => {
    const highlights = repo.deleteHighlight(req.currentUser.id, req.params.id);
    res.json({ highlights });
  });
  app.get("/api/comments", (req, res) => {
    const chapterId = typeof req.query.chapterId === "string" ? req.query.chapterId : void 0;
    res.json({ comments: repo.getComments(chapterId) });
  });
  app.post("/api/comments", requireAuth, (req, res) => {
    const { storyId, chapterId, tag, body } = req.body;
    const cleanedBody = String(body || "").trim();
    if (!storyId || !chapterId || cleanedBody.length < 2 || cleanedBody.length > 1e3) {
      res.status(400).json({ error: "Comment body must be between 2 and 1000 characters." });
      return;
    }
    const safeTag = ["Reaction", "Lore", "Theory"].includes(String(tag)) ? tag : "Reaction";
    const comment = repo.addComment({
      id: `cmt_${crypto2.randomUUID()}`,
      storyId,
      chapterId,
      authorName: req.currentUser.name,
      tag: safeTag,
      body: cleanedBody,
      createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    });
    res.status(201).json({ comment });
  });
  app.delete("/api/comments/:id", requireAuth, (req, res) => {
    const ok = repo.deleteComment(
      req.params.id,
      req.currentUser.name,
      req.currentUser.role === "owner"
    );
    if (!ok) {
      res.status(403).json({ error: "Unable to delete comment." });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/payments/initialize", requireAuth, aiLimiter, async (req, res) => {
    const { itemType, planId, storyId } = req.body;
    const user = req.currentUser;
    let amountNgn = 0;
    let itemName = "";
    let resolvedPlanId;
    let resolvedStoryId;
    if (itemType === "subscription") {
      const pid = planId === "annual" ? "annual" : "monthly";
      const plan = PLAN_PRICES_NGN[pid];
      amountNgn = plan.amountNgn;
      itemName = plan.label;
      resolvedPlanId = pid;
    } else if (itemType === "book_purchase" && storyId) {
      const story = repo.getStoryById(storyId);
      if (!story) {
        res.status(404).json({ error: "Selected story not found." });
        return;
      }
      if (story.priceNgn <= 0) {
        res.status(400).json({ error: "This title does not require purchase." });
        return;
      }
      amountNgn = story.priceNgn;
      itemName = `Book Unlock: ${story.title}`;
      resolvedStoryId = story.id;
    } else {
      res.status(400).json({ error: "Valid itemType and item selection are required." });
      return;
    }
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!paystackSecret) {
      res.status(503).json({
        mode: "unconfigured",
        error: "Paystack hosted checkout is not configured in this environment yet (requires PAYSTACK_SECRET_KEY on server)."
      });
      return;
    }
    const order = repo.createOrder({
      userId: user.id,
      customerEmail: user.email,
      itemType,
      planId: resolvedPlanId,
      storyId: resolvedStoryId,
      itemName,
      amountNgn
    });
    const baseUrl = process.env.APP_URL?.trim() || `${req.protocol}://${req.get("host")}`;
    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/pricing`;
    try {
      const response = await withTimeout(
        fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: user.email,
            amount: amountNgn * 100,
            currency: "NGN",
            reference: order.reference,
            callback_url: callbackUrl,
            metadata: {
              orderId: order.id,
              userId: user.id,
              itemType,
              planId: resolvedPlanId,
              storyId: resolvedStoryId
            }
          })
        })
      );
      const json = await response.json();
      if (!response.ok || !json.status || !json.data?.authorization_url) {
        res.status(502).json({
          error: json.message || "Paystack refused to initialize transaction."
        });
        return;
      }
      res.json({
        mode: "hosted",
        authorizationUrl: json.data.authorization_url,
        reference: order.reference,
        amountNgn: order.amountNgn,
        itemName: order.itemName
      });
    } catch {
      res.status(502).json({ error: "Failed to reach Paystack gateway. Please retry." });
    }
  });
  app.post("/api/payments/verify", requireAuth, async (req, res) => {
    const { reference } = req.body;
    if (!reference) {
      res.status(400).json({ error: "Transaction reference is required." });
      return;
    }
    const user = req.currentUser;
    const order = repo.getOrderByReference(reference);
    if (!order || order.userId !== user.id && user.role !== "owner") {
      res.status(404).json({ error: "Order reference not found for your account." });
      return;
    }
    if (order.status === "success") {
      res.json({
        ok: true,
        status: "success",
        user: repo.toPublicProfile(user),
        transactions: repo.getUserTransactions(user.id)
      });
      return;
    }
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!paystackSecret) {
      res.status(503).json({ error: "Paystack verification is not configured on the server." });
      return;
    }
    try {
      const response = await withTimeout(
        fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: {
            Authorization: `Bearer ${paystackSecret}`
          }
        })
      );
      const json = await response.json();
      if (!response.ok || !json.status || json.data?.status !== "success") {
        res.status(402).json({
          ok: false,
          status: json.data?.status || "pending",
          error: "Payment has not completed on Paystack yet."
        });
        return;
      }
      const result = repo.fulfillOrderIdempotently(
        reference,
        Number(json.data.amount || 0),
        String(json.data.currency || "NGN"),
        mapPaystackChannel(json.data.channel),
        String(json.data.id ?? reference)
      );
      if (!result.ok) {
        res.status(400).json({ error: result.reason || "Payment verification failed." });
        return;
      }
      const refreshed = repo.getUserById(user.id) || user;
      res.json({
        ok: true,
        status: "success",
        user: repo.toPublicProfile(refreshed),
        transactions: repo.getUserTransactions(user.id)
      });
    } catch {
      res.status(502).json({ error: "Unable to verify Paystack transaction." });
    }
  });
  app.get("/api/admin/overview", requireAuth, requireOwner, (_req, res) => {
    res.json(repo.getAdminOverview());
  });
  app.post("/api/admin/stories", requireAuth, requireOwner, (req, res) => {
    const body = req.body;
    const title = String(body.title || "").trim();
    const synopsis = String(body.synopsis || "").trim();
    if (title.length < 2 || synopsis.length < 10) {
      res.status(400).json({ error: "Story title and synopsis are required." });
      return;
    }
    const story = repo.addStory({
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      title,
      subtitle: String(body.subtitle || "An Original Lorethos Release").trim(),
      author: String(body.author || "Lorethos Editorial").trim(),
      authorBio: "Published author on Lorethos.",
      genre: String(body.genre || "Epic Fantasy").trim(),
      tags: [String(body.genre || "Fiction").trim(), "Serialized"],
      coverImage: String(body.coverImage || "/assets/images/book_cover_obsidian_throne_1794465561565.jpg"),
      synopsis,
      prologueLore: "Published directly from the Lorethos Publishing Desk.",
      status: "Ongoing",
      accessTier: ["free", "subscription", "purchase"].includes(String(body.accessTier)) ? body.accessTier : "subscription",
      priceNgn: Math.max(0, Number(body.priceNgn || 2500)),
      rating: 0,
      ratingsCount: 0,
      totalChapters: 1,
      totalReads: 0,
      freeChaptersCount: 3,
      featured: false,
      updatedAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    });
    res.status(201).json({ story: sanitizeStoryForPublic(story) });
  });
  app.post("/api/admin/stories/:storyId/chapters", requireAuth, requireOwner, (req, res) => {
    const body = req.body;
    const title = String(body.title || "").trim();
    const paragraphs = Array.isArray(body.content) ? body.content.map((p) => String(p).trim()).filter(Boolean) : [];
    if (!title || paragraphs.length === 0) {
      res.status(400).json({ error: "Chapter title and prose content are required." });
      return;
    }
    const wordCount = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
    const chapter = repo.addChapterToStory(req.params.storyId, {
      chapterNumber: Number(body.chapterNumber || 1),
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      releaseDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      }),
      wordCount,
      readTimeMinutes: Math.max(2, Math.round(wordCount / 250)),
      isFree: Boolean(body.isFree),
      excerpt: String(body.excerpt || paragraphs[0]).slice(0, 260),
      content: paragraphs
    });
    if (!chapter) {
      res.status(404).json({ error: "Target story not found." });
      return;
    }
    const updatedStory = repo.getStoryById(req.params.storyId);
    res.status(201).json({ chapter, story: sanitizeStoryForPublic(updatedStory) });
  });
  app.patch("/api/admin/stories/:storyId/pricing", requireAuth, requireOwner, (req, res) => {
    const { accessTier, priceNgn, freeChaptersCount } = req.body;
    const updated = repo.updateStoryPricing(
      req.params.storyId,
      ["free", "subscription", "purchase"].includes(String(accessTier)) ? accessTier : "subscription",
      Number(priceNgn ?? 2500),
      Number(freeChaptersCount ?? 3)
    );
    if (!updated) {
      res.status(404).json({ error: "Story not found." });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(updated) });
  });
  app.post("/api/ai/companion", aiLimiter, async (req, res) => {
    try {
      const { mode, question, storySlug, chapterNumber } = req.body;
      const story = storySlug ? repo.getStoryBySlug(storySlug) : void 0;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);
      if (!story || !chapter) {
        res.status(404).json({ error: "Story or chapter could not be found." });
        return;
      }
      const user = getAuthenticatedUser(req);
      if (!repo.hasAccessToChapter(user, story, chapter)) {
        res.status(403).json({
          error: "Unlock this chapter before querying the companion on its full contents."
        });
        return;
      }
      const safeQuestion = String(question || "").trim().slice(0, 600);
      if (mode === "ask" && !safeQuestion) {
        res.status(400).json({ error: "Please enter a question about the chapter." });
        return;
      }
      const ai = getGeminiClient();
      const chapterText = chapter.content.join("\n\n").slice(0, 12e3);
      const contextBlock = [
        `Title: ${story.title} by ${story.author} (${story.genre})`,
        `Synopsis: ${story.synopsis}`,
        `World Lore: ${story.prologueLore}`,
        `Current Chapter ${chapter.chapterNumber}: "${chapter.title}"`,
        `Chapter Prose:
${chapterText}`
      ].join("\n\n");
      const prompt = mode === "recap" ? `Provide a spoiler-free recap of Chapter ${chapter.chapterNumber} ("${chapter.title}"). Keep it concise (3 short bullet points highlighting key events, character stakes, and setting). Do not invent events outside the provided text.` : `Answer the reader's question clearly and concisely (2-4 sentences) using only the provided story lore and chapter prose. Question: "${safeQuestion}"`;
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `${contextBlock}

Task: ${prompt}`,
          config: {
            systemInstruction: "You are a concise literary reading companion for Lorethos. Be accurate to the text and strictly spoiler-free beyond the current chapter.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          }
        })
      );
      res.json({ reply: (response.text ?? "").trim() });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/ai/recommend", aiLimiter, async (req, res) => {
    try {
      const { moodPrompt } = req.body;
      const cleanMood = String(moodPrompt || "").trim().slice(0, 400);
      if (!cleanMood) {
        res.status(400).json({ error: "Please describe what kind of story you want to read." });
        return;
      }
      const catalog = repo.getStories();
      const ai = getGeminiClient();
      const catalogSummary = catalog.map(
        (s) => `- slug: "${s.slug}" | title: "${s.title}" | genre: "${s.genre}" | author: "${s.author}" | tags: [${s.tags.join(", ")}] | synopsis: ${s.synopsis}`
      ).join("\n");
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Reader preference: "${cleanMood}"

Available Catalog:
${catalogSummary}

Select up to 3 best-matching stories from the catalog above (ordered best match first). Only use slugs that exist in the catalog.`,
          config: {
            systemInstruction: "You are a literary curator at Lorethos. Match readers to stories strictly from the provided catalog with clear, specific explanations.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                curatorNote: {
                  type: Type.STRING,
                  description: "A brief 1-sentence greeting tailored to the reader mood."
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slug: { type: Type.STRING },
                      vibeTag: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["slug", "vibeTag", "reason"]
                  }
                }
              },
              required: ["curatorNote", "recommendations"]
            }
          }
        })
      );
      const raw = (response.text ?? "{}").trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/ai/scriptorium", requireAuth, requireOwner, aiLimiter, async (req, res) => {
    try {
      const { task, storyTitle, genre, chapterTitle, outline, existingSynopsis } = req.body;
      const safeTitle = String(storyTitle || "Untitled Story").slice(0, 140);
      const safeGenre = String(genre || "Epic Fantasy").slice(0, 80);
      const safeChapterTitle = String(chapterTitle || "New Chapter").slice(0, 140);
      const safeOutline = String(outline || existingSynopsis || "").slice(0, 1200);
      const ai = getGeminiClient();
      if (task === "craft_synopsis") {
        const response2 = await withTimeout(
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Story Title: "${safeTitle}"
Genre: ${safeGenre}
Author notes: "${safeOutline || "Original narrative"}"

Write a concise, publication-ready synopsis in 2-3 sentences that hooks readers without giving away the ending.`,
            config: {
              systemInstruction: "You are a literary editor at Lorethos Publishing. Craft compelling book synopses.",
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
          })
        );
        res.json({ synopsis: (response2.text ?? "").trim() });
        return;
      }
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Story: "${safeTitle}" (${safeGenre})
Chapter Title: "${safeChapterTitle}"
Scene Outline / Prompt: "${safeOutline || "Continue the narrative tension with rich atmosphere and dialogue."}"

Write an immersive 3-4 paragraph opening chapter draft and a gripping 1-sentence teaser excerpt.`,
          config: {
            systemInstruction: "You are a co-author at Lorethos. Produce vivid serialized fiction prose with strong pacing.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                excerpt: {
                  type: Type.STRING,
                  description: "A compelling one-sentence teaser hook for chapter previews."
                },
                paragraphs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3 to 4 prose paragraphs forming the chapter draft."
                }
              },
              required: ["excerpt", "paragraphs"]
            }
          }
        })
      );
      const raw = (response.text ?? "{}").trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/ai/tts", aiLimiter, async (req, res) => {
    try {
      const { storySlug, chapterNumber, voiceName } = req.body;
      const story = storySlug ? repo.getStoryBySlug(storySlug) : void 0;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);
      if (!story || !chapter) {
        res.status(404).json({ error: "Story or chapter could not be found." });
        return;
      }
      const user = getAuthenticatedUser(req);
      if (!repo.hasAccessToChapter(user, story, chapter)) {
        res.status(403).json({
          error: "Unlock this chapter before generating full chapter audio narration."
        });
        return;
      }
      const cleaned = chapter.content.join("\n\n").trim();
      if (!cleaned) {
        res.status(400).json({ error: "Chapter narration text is empty." });
        return;
      }
      const allowedVoices = /* @__PURE__ */ new Set(["Kore", "Charon", "Puck", "Zephyr"]);
      const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : "Kore";
      const cappedText = cleaned.slice(0, 3200);
      const intro = `${story.title}. Chapter ${chapter.chapterNumber}: ${chapter.title}.

`;
      const ai = getGeminiClient();
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: `Read in a warm, clear literary audiobook narration style:

${intro}${cappedText}`,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice
                }
              }
            }
          }
        }),
        3e4
      );
      const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioPart?.data) {
        res.status(502).json({ error: "Audio narration was not returned by the model." });
        return;
      }
      res.json({
        audioBase64: audioPart.data,
        mimeType: audioPart.mimeType || "audio/wav",
        voiceName: selectedVoice
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/inquiries", inquiryLimiter, (req, res) => {
    const { name, email, inquiryType, subject, message, website } = req.body;
    if (website && website.trim().length > 0) {
      res.status(400).json({ error: "Submission rejected." });
      return;
    }
    const safeName = String(name || "").trim();
    const safeEmail = String(email || "").trim();
    const safeSubject = String(subject || "").trim();
    const safeMessage = String(message || "").trim();
    if (safeName.length < 2 || safeName.length > 120) {
      res.status(400).json({ error: "Please provide your name (2-120 characters)." });
      return;
    }
    if (!EMAIL_REGEX.test(safeEmail)) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    if (safeSubject.length < 2 || safeSubject.length > 160) {
      res.status(400).json({ error: "Please provide a subject (2-160 characters)." });
      return;
    }
    if (safeMessage.length < 10 || safeMessage.length > 3e3) {
      res.status(400).json({ error: "Message must be between 10 and 3000 characters." });
      return;
    }
    const referenceId = `INQ-${Date.now().toString(36).toUpperCase()}`;
    const inquiry = repo.addInquiry({
      id: `inq_${crypto2.randomUUID()}`,
      referenceId,
      name: safeName,
      email: safeEmail,
      inquiryType: String(inquiryType || "Reader Feedback").slice(0, 80),
      subject: safeSubject,
      message: safeMessage,
      submittedAt: (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    });
    res.status(201).json({
      ok: true,
      referenceId: inquiry.referenceId,
      receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
      inquiry
    });
  });
  app.get("/api/export-zip", requireAuth, requireOwner, async (_req, res) => {
    try {
      const zip = new JSZip();
      const excludedDirs = /* @__PURE__ */ new Set([
        "node_modules",
        "dist",
        "dist-server",
        ".git",
        ".vercel",
        ".next"
      ]);
      const excludedFiles = /* @__PURE__ */ new Set([".env", ".env.local", ".env.production", ".DS_Store"]);
      const addDirToZip = async (dirPath, relBase) => {
        const entries = await fs2.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (excludedDirs.has(entry.name)) continue;
            const nextAbs = path2.join(dirPath, entry.name);
            const nextRel = relBase ? `${relBase}/${entry.name}` : entry.name;
            await addDirToZip(nextAbs, nextRel);
          } else if (entry.isFile()) {
            if (excludedFiles.has(entry.name) || entry.name.endsWith(".zip")) continue;
            const absFile = path2.join(dirPath, entry.name);
            const zipPath = relBase ? `${relBase}/${entry.name}` : entry.name;
            const content = await fs2.readFile(absFile);
            zip.file(zipPath, content);
          }
        }
      };
      await addDirToZip(__dirname, "");
      const buffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="lorethos-source.zip"');
      res.setHeader("Content-Length", String(buffer.length));
      res.send(buffer);
    } catch {
      res.status(500).json({ error: "Failed to build ZIP archive." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(__dirname, "dist");
    try {
      await fs2.access(distPath);
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    } catch {
      app.get("/", (_req, res) => {
        res.json({ ok: true, service: "lorethos-api" });
      });
    }
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lorethos server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
