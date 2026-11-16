// server.ts
import "dotenv/config";
import crypto2 from "node:crypto";
import fs2 from "node:fs/promises";
import http from "node:http";
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
    publicationStatus: "published",
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
    publicationStatus: "published",
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
    publicationStatus: "published",
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
    publicationStatus: "published",
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
  },
  {
    id: "story-harmattan-verses",
    slug: "verses-of-the-harmattan",
    title: "Verses of the Harmattan",
    subtitle: "Collected Poems of Dust, Brass Lanterns, and Atlantic Dusk",
    author: "Kemi Adeyemi",
    authorBio: "Poet and essayist writing between Lagos and Accra, exploring memory, seasonal winds, and oral lyricism.",
    genre: "Poetry",
    tags: ["Poetry", "Lyric Verse", "Oral Tradition", "Anthology"],
    coverImage: "/assets/images/book_cover_whispering_savanna_1794465562207.jpg",
    synopsis: "A serialized poetry anthology tracing the dry northern wind from Sahelian courtyards to coastal harbors\u2014meditations on longing, kinship, and light surviving dust.",
    prologueLore: "Each installment gathers three rhythmic cantos meant to be read slowly aloud at dusk.",
    status: "Ongoing",
    publicationStatus: "published",
    accessTier: "free",
    priceNgn: 0,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 3,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: false,
    spotlightOrder: 5,
    updatedAt: "Nov 2026",
    chapters: [
      {
        id: "ch-harmattan-1",
        storyId: "story-harmattan-verses",
        chapterNumber: 1,
        title: "I. When the Red Dust Arrives",
        slug: "when-the-red-dust-arrives",
        releaseDate: "Oct 18, 2026",
        wordCount: 420,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: "At dawn the mango leaves wore a thin coat of ochre, and every door remembered the desert.",
        content: [
          "At dawn the mango leaves wore a thin coat of ochre, and every door remembered the desert.",
          "We lit the brass lantern before sunrise, watching silver motes drift across the veranda like unspoken letters.",
          "Dry wind carries no rain, yet it softens every hard edge of the city into amber quiet\u2014a truce between yesterday and bloom."
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-harmattan-2",
        storyId: "story-harmattan-verses",
        chapterNumber: 2,
        title: "II. Elegy for the Ferryman",
        slug: "elegy-for-the-ferryman",
        releaseDate: "Oct 25, 2026",
        wordCount: 390,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: "His wooden oar measured the tide better than any clock in the harbor tower.",
        content: [
          "His wooden oar measured the tide better than any clock in the harbor tower.",
          "Salt and cedar smoke lingered on his coat; he spoke only in gentle proverbs about patience and returning water.",
          "Now the lagoon keeps his cadence in the hush between evening bells."
        ],
        ambientSoundscape: "rain"
      },
      {
        id: "ch-harmattan-3",
        storyId: "story-harmattan-verses",
        chapterNumber: 3,
        title: "III. Starlight on Tin Roofs",
        slug: "starlight-on-tin-roofs",
        releaseDate: "Nov 02, 2026",
        wordCount: 460,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: "Night cools the corrugated iron until the whole street sings with tiny metallic sighs.",
        content: [
          "Night cools the corrugated iron until the whole street sings with tiny metallic sighs.",
          "Above the courtyard, constellations bloom clear and radiant through the thinning haze, reminding us how small our quarrels are beneath an eternal sky."
        ],
        ambientSoundscape: "mythic_drone"
      }
    ]
  },
  {
    id: "story-lagoon-letters",
    slug: "letters-across-the-lagoon",
    title: "Letters Across the Lagoon",
    subtitle: "An Epistolary Novel of Two Architects Rebuilding a Waterfront Library",
    author: "Tunde Babalola",
    authorBio: "Fiction writer and urban chronicler focusing on memory, architecture, and quiet human resilience.",
    genre: "Literary Fiction",
    tags: ["Fiction", "Epistolary", "Contemporary", "Drama"],
    coverImage: "/assets/images/book_cover_sunken_epoch_1794465563519.jpg",
    synopsis: "Separated by a decade of silence and a contested waterfront restoration, two former partners exchange handwritten letters tucked inside architectural blueprints\u2014uncovering what happened the night the old reading hall burned.",
    prologueLore: "Every chapter pairs one unsent draft with the letter that finally crossed the water.",
    status: "Completed",
    publicationStatus: "published",
    accessTier: "free",
    priceNgn: 0,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 3,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: false,
    spotlightOrder: 6,
    updatedAt: "Nov 2026",
    chapters: [
      {
        id: "ch-lagoon-1",
        storyId: "story-lagoon-letters",
        chapterNumber: 1,
        title: "Blueprint in Blue Ink",
        slug: "blueprint-in-blue-ink",
        releaseDate: "Oct 10, 2026",
        wordCount: 1850,
        readTimeMinutes: 7,
        isFree: true,
        excerpt: "You left your compass on the drafting table, as if you expected the tide to wait for our second draft.",
        content: [
          "You left your compass on the drafting table, as if you expected the tide to wait for our second draft.",
          "The ferry from Tarkwa Bay still shakes at the pier every morning at seven. I carried your rolled elevations up the timber stairs and spread them across the long mahogany desk.",
          "Someone had circled the west reading terrace in faint red pencil\u2014the exact corner where the roof timbers gave way ten winters ago."
        ],
        ambientSoundscape: "rain"
      },
      {
        id: "ch-lagoon-2",
        storyId: "story-lagoon-letters",
        chapterNumber: 2,
        title: "The Salt-Stained Ledger",
        slug: "the-salt-stained-ledger",
        releaseDate: "Oct 17, 2026",
        wordCount: 1920,
        readTimeMinutes: 8,
        isFree: true,
        excerpt: "Truth rarely arrives in grand speeches; mostly it hides in margin notes and forgotten invoices.",
        content: [
          "Truth rarely arrives in grand speeches; mostly it hides in margin notes and forgotten invoices.",
          "Inside the archive drawer beneath the floorboards, Ada found the contractor receipt dated two days before the fire\u2014signed by a councilman who swore he had never visited the pier."
        ],
        ambientSoundscape: "fireplace"
      },
      {
        id: "ch-lagoon-3",
        storyId: "story-lagoon-letters",
        chapterNumber: 3,
        title: "Opening the Timber Windows",
        slug: "opening-the-timber-windows",
        releaseDate: "Oct 24, 2026",
        wordCount: 2100,
        readTimeMinutes: 8,
        isFree: true,
        excerpt: "When the shutters finally swung wide, golden afternoon light flooded every empty shelf.",
        content: [
          "When the shutters finally swung wide, golden afternoon light flooded every empty shelf.",
          "Breeze off the lagoon carried the scent of fresh cedar and rain-washed stone as the first crates of books arrived at the harbor steps."
        ],
        ambientSoundscape: "rain"
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
function getOwnerEmail() {
  return (process.env.OWNER_EMAIL || "Emmymasterwise@gmail.com").trim().toLowerCase();
}
function getStateFilePath() {
  return process.env.LORETHOS_DATA_FILE || "/tmp/lorethos-server-state.json";
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
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
    this.initialized = false;
    this.initPromise = null;
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
      const isLocalDb = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") || databaseUrl.includes("@postgres:");
      const disableSsl = databaseUrl.includes("sslmode=disable");
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        connectionTimeoutMillis: 1e4,
        ...isLocalDb || disableSsl ? {} : { ssl: { rejectUnauthorized: false } }
      });
      this.pool.on("error", (err) => {
        console.error("PostgreSQL pool error:", err);
      });
    }
    this.state = this.loadInitialSnapshot();
  }
  loadInitialSnapshot() {
    const stateFile = getStateFilePath();
    try {
      if (fs.existsSync(stateFile)) {
        const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        if (Array.isArray(parsed.stories) && parsed.stories.length > 0) {
          return {
            users: parsed.users || [],
            stories: parsed.stories.map((s) => ({
              ...s,
              publicationStatus: s.publicationStatus || "published",
              totalChapters: s.chapters.length
            })),
            orders: parsed.orders || [],
            processedEventIds: parsed.processedEventIds || [],
            highlights: parsed.highlights || {},
            comments: parsed.comments || [],
            inquiries: parsed.inquiries || []
          };
        }
      }
    } catch {
    }
    return {
      users: [],
      stories: AUTHORITATIVE_STORIES.map((s) => ({
        ...s,
        publicationStatus: s.publicationStatus || "published",
        totalChapters: s.chapters.length
      })),
      orders: [],
      processedEventIds: [],
      highlights: {},
      comments: [],
      inquiries: []
    };
  }
  persistSnapshot() {
    const stateFile = getStateFilePath();
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
    } catch {
    }
  }
  mirrorToPostgres(task) {
    if (!this.pool) return;
    const pool = this.pool;
    void task(pool).catch((err) => {
      console.error("PostgreSQL persistence mirror warning:", err instanceof Error ? err.message : err);
    });
  }
  async ensurePostgresSchema(pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'owner')),
        reading_goal JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_goal JSONB;
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        author TEXT NOT NULL,
        author_bio TEXT NOT NULL,
        genre TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        cover_image TEXT NOT NULL,
        synopsis TEXT NOT NULL,
        prologue_lore TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ongoing' CHECK (status IN ('Ongoing', 'Completed', 'Hiatus')),
        publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('draft', 'review', 'published')),
        access_tier TEXT NOT NULL DEFAULT 'subscription' CHECK (access_tier IN ('free', 'subscription', 'purchase')),
        price_ngn INTEGER NOT NULL DEFAULT 0 CHECK (price_ngn >= 0),
        free_chapters_count INTEGER NOT NULL DEFAULT 3 CHECK (free_chapters_count >= 0),
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        spotlight_order INTEGER,
        updated_at_label TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published';
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        release_date_label TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        read_time_minutes INTEGER NOT NULL DEFAULT 1,
        is_free BOOLEAN NOT NULL DEFAULT FALSE,
        excerpt TEXT NOT NULL,
        content JSONB NOT NULL DEFAULT '[]'::jsonb,
        ambient_soundscape TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (story_id, chapter_number)
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_email TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'book_purchase')),
        plan_id TEXT CHECK (plan_id IN ('monthly', 'annual')),
        story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
        item_name TEXT NOT NULL,
        amount_ngn INTEGER NOT NULL CHECK (amount_ngn > 0),
        currency TEXT NOT NULL DEFAULT 'NGN',
        channel TEXT NOT NULL DEFAULT 'hosted',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fulfilled_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id TEXT PRIMARY KEY,
        order_reference TEXT REFERENCES orders(reference) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS entitlements (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        source_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, story_id)
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'annual')),
        status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('active', 'expired', 'none')),
        amount_ngn INTEGER NOT NULL DEFAULT 0,
        valid_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS reading_progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL,
        progress_percent INTEGER NOT NULL CHECK (progress_percent >= 0 AND progress_percent <= 100),
        last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, story_id)
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, chapter_id)
      );
      CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        paragraph_index INTEGER NOT NULL,
        excerpt TEXT NOT NULL,
        color TEXT NOT NULL CHECK (color IN ('terracotta', 'gold', 'sage')),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, chapter_id, paragraph_index)
      );
      CREATE TABLE IF NOT EXISTS chapter_comments (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        tag TEXT NOT NULL CHECK (tag IN ('Reaction', 'Lore', 'Theory')),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        reference_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        inquiry_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM stories");
    if ((countRes.rows[0]?.cnt ?? 0) === 0) {
      for (const story of AUTHORITATIVE_STORIES) {
        await pool.query(
          `INSERT INTO stories (
            id, slug, title, subtitle, author, author_bio, genre, tags,
            cover_image, synopsis, prologue_lore, status, publication_status,
            access_tier, price_ngn, free_chapters_count, featured, spotlight_order, updated_at_label
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (id) DO NOTHING`,
          [
            story.id,
            story.slug,
            story.title,
            story.subtitle,
            story.author,
            story.authorBio,
            story.genre,
            JSON.stringify(story.tags),
            story.coverImage,
            story.synopsis,
            story.prologueLore,
            story.status,
            story.publicationStatus || "published",
            story.accessTier,
            story.priceNgn,
            story.freeChaptersCount,
            story.featured,
            story.spotlightOrder ?? null,
            story.updatedAt
          ]
        );
        for (const ch of story.chapters) {
          await pool.query(
            `INSERT INTO chapters (
              id, story_id, chapter_number, title, slug, release_date_label,
              word_count, read_time_minutes, is_free, excerpt, content, ambient_soundscape
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
            ON CONFLICT (id) DO NOTHING`,
            [
              ch.id,
              story.id,
              ch.chapterNumber,
              ch.title,
              ch.slug,
              ch.releaseDate,
              ch.wordCount,
              ch.readTimeMinutes,
              ch.isFree,
              ch.excerpt,
              JSON.stringify(ch.content),
              ch.ambientSoundscape ?? null
            ]
          );
        }
      }
    }
  }
  async initDatabase() {
    const pool = this.pool;
    if (this.initialized || !pool) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        await this.ensurePostgresSchema(pool);
        await pool.query("SELECT 1 FROM stories LIMIT 1");
        this.initialized = true;
        const [
          storiesRes,
          chaptersRes,
          usersRes,
          subsRes,
          entRes,
          bmRes,
          progRes,
          hlRes,
          cmtRes,
          ordRes,
          evRes,
          inqRes
        ] = await Promise.all([
          pool.query("SELECT * FROM stories ORDER BY spotlight_order ASC NULLS LAST, created_at DESC"),
          pool.query("SELECT * FROM chapters ORDER BY chapter_number ASC"),
          pool.query("SELECT * FROM users"),
          pool.query("SELECT * FROM subscriptions"),
          pool.query("SELECT * FROM entitlements"),
          pool.query("SELECT * FROM bookmarks"),
          pool.query("SELECT * FROM reading_progress"),
          pool.query("SELECT * FROM highlights ORDER BY created_at DESC"),
          pool.query("SELECT * FROM chapter_comments ORDER BY created_at DESC"),
          pool.query("SELECT * FROM orders ORDER BY created_at DESC"),
          pool.query("SELECT event_id FROM payment_events"),
          pool.query("SELECT * FROM contacts ORDER BY submitted_at DESC")
        ]);
        if (storiesRes.rows.length > 0) {
          const chaptersByStory = /* @__PURE__ */ new Map();
          for (const row of chaptersRes.rows) {
            const list = chaptersByStory.get(row.story_id) || [];
            list.push({
              id: row.id,
              storyId: row.story_id,
              chapterNumber: Number(row.chapter_number),
              title: row.title,
              slug: row.slug,
              releaseDate: row.release_date_label,
              wordCount: Number(row.word_count),
              readTimeMinutes: Number(row.read_time_minutes),
              isFree: Boolean(row.is_free),
              excerpt: row.excerpt,
              content: Array.isArray(row.content) ? row.content : [],
              ambientSoundscape: row.ambient_soundscape || void 0
            });
            chaptersByStory.set(row.story_id, list);
          }
          this.state.stories = storiesRes.rows.map((row) => {
            const chs = chaptersByStory.get(row.id) || [];
            return {
              id: row.id,
              slug: row.slug,
              title: row.title,
              subtitle: row.subtitle,
              author: row.author,
              authorBio: row.author_bio,
              genre: row.genre,
              tags: Array.isArray(row.tags) ? row.tags : [],
              coverImage: row.cover_image,
              synopsis: row.synopsis,
              prologueLore: row.prologue_lore,
              status: row.status,
              publicationStatus: row.publication_status || "published",
              accessTier: row.access_tier,
              priceNgn: Number(row.price_ngn),
              rating: 0,
              ratingsCount: 0,
              totalChapters: chs.length,
              totalReads: 0,
              freeChaptersCount: Number(row.free_chapters_count),
              featured: Boolean(row.featured),
              spotlightOrder: row.spotlight_order !== null ? Number(row.spotlight_order) : void 0,
              updatedAt: row.updated_at_label,
              chapters: chs
            };
          });
        }
        const subByUser = /* @__PURE__ */ new Map();
        for (const s of subsRes.rows) {
          subByUser.set(s.user_id, {
            plan: s.plan,
            status: s.status,
            amountNgn: Number(s.amount_ngn),
            validUntil: s.valid_until ? new Date(s.valid_until).toISOString() : void 0,
            renewsAt: s.valid_until ? new Date(s.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : void 0
          });
        }
        const entitlementsByUser = /* @__PURE__ */ new Map();
        for (const e of entRes.rows) {
          const list = entitlementsByUser.get(e.user_id) || [];
          list.push(e.story_id);
          entitlementsByUser.set(e.user_id, list);
        }
        const bookmarksByUser = /* @__PURE__ */ new Map();
        for (const b of bmRes.rows) {
          const list = bookmarksByUser.get(b.user_id) || [];
          list.push(b.chapter_id);
          bookmarksByUser.set(b.user_id, list);
        }
        const progressByUser = /* @__PURE__ */ new Map();
        for (const p of progRes.rows) {
          const map = progressByUser.get(p.user_id) || {};
          map[p.story_id] = {
            chapterId: p.chapter_id,
            chapterNumber: Number(p.chapter_number),
            progressPercent: Number(p.progress_percent),
            lastReadAt: new Date(p.last_read_at).toISOString()
          };
          progressByUser.set(p.user_id, map);
        }
        this.state.users = usersRes.rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          passwordHash: u.password_hash,
          role: u.role,
          subscription: subByUser.get(u.id) || { plan: "free", status: "none", amountNgn: 0 },
          unlockedStoryIds: entitlementsByUser.get(u.id) || [],
          bookmarkedChapterIds: bookmarksByUser.get(u.id) || [],
          readingProgress: progressByUser.get(u.id) || {},
          readingGoal: u.reading_goal || buildDefaultReadingGoal(),
          createdAt: new Date(u.created_at).toISOString()
        }));
        this.state.highlights = {};
        const storyLookup = new Map(this.state.stories.map((s) => [s.id, s]));
        for (const h of hlRes.rows) {
          const st = storyLookup.get(h.story_id);
          const ch = st?.chapters.find((c) => c.id === h.chapter_id);
          const list = this.state.highlights[h.user_id] || [];
          list.push({
            id: h.id,
            storyId: h.story_id,
            storyTitle: st?.title || "",
            storySlug: st?.slug || "",
            chapterId: h.chapter_id,
            chapterNumber: ch?.chapterNumber || 1,
            chapterTitle: ch?.title || "",
            paragraphIndex: Number(h.paragraph_index),
            excerpt: h.excerpt,
            color: h.color,
            note: h.note || void 0,
            createdAt: new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          });
          this.state.highlights[h.user_id] = list;
        }
        this.state.comments = cmtRes.rows.map((c) => ({
          id: c.id,
          storyId: c.story_id,
          chapterId: c.chapter_id,
          authorName: c.author_name,
          tag: c.tag,
          body: c.body,
          createdAt: new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        }));
        this.state.orders = ordRes.rows.map((o) => ({
          id: o.id,
          reference: o.reference,
          userId: o.user_id,
          customerEmail: o.customer_email,
          itemType: o.item_type,
          planId: o.plan_id || void 0,
          storyId: o.story_id || void 0,
          itemName: o.item_name,
          amountNgn: Number(o.amount_ngn),
          currency: "NGN",
          channel: o.channel,
          status: o.status,
          createdAt: new Date(o.created_at).toISOString(),
          fulfilledAt: o.fulfilled_at ? new Date(o.fulfilled_at).toISOString() : void 0
        }));
        this.state.processedEventIds = evRes.rows.map((e) => e.event_id);
        this.state.inquiries = inqRes.rows.map((i) => ({
          id: i.id,
          referenceId: i.reference_id,
          name: i.name,
          email: i.email,
          inquiryType: i.inquiry_type,
          subject: i.subject,
          message: i.message,
          submittedAt: new Date(i.submitted_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })
        }));
      } catch (err) {
        console.warn(
          "PostgreSQL hydration skipped (schema may not be migrated yet); running with local snapshot:",
          err instanceof Error ? err.message : err
        );
      } finally {
        this.initPromise = null;
      }
    })();
    return this.initPromise;
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
  async hydrateSingleUserFromPostgres(whereClause, param) {
    if (!this.pool) return void 0;
    try {
      const userRes = await this.pool.query(
        `SELECT * FROM users WHERE ${whereClause} LIMIT 1`,
        [param]
      );
      if (userRes.rows.length === 0) return void 0;
      const u = userRes.rows[0];
      const [subRes, entRes, bmRes, progRes] = await Promise.all([
        this.pool.query("SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1", [u.id]),
        this.pool.query("SELECT story_id FROM entitlements WHERE user_id = $1", [u.id]),
        this.pool.query("SELECT chapter_id FROM bookmarks WHERE user_id = $1", [u.id]),
        this.pool.query("SELECT * FROM reading_progress WHERE user_id = $1", [u.id])
      ]);
      const subRow = subRes.rows[0];
      const subscription = subRow ? {
        plan: subRow.plan,
        status: subRow.status,
        amountNgn: Number(subRow.amount_ngn),
        validUntil: subRow.valid_until ? new Date(subRow.valid_until).toISOString() : void 0,
        renewsAt: subRow.valid_until ? new Date(subRow.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : void 0
      } : { plan: "free", status: "none", amountNgn: 0 };
      const readingProgress = {};
      for (const p of progRes.rows) {
        readingProgress[p.story_id] = {
          chapterId: p.chapter_id,
          chapterNumber: Number(p.chapter_number),
          progressPercent: Number(p.progress_percent),
          lastReadAt: new Date(p.last_read_at).toISOString()
        };
      }
      const hydrated = {
        id: u.id,
        name: u.name,
        email: String(u.email).trim().toLowerCase(),
        passwordHash: u.password_hash,
        role: u.role === "owner" || String(u.email).trim().toLowerCase() === getOwnerEmail() ? "owner" : "reader",
        subscription,
        unlockedStoryIds: entRes.rows.map((r) => r.story_id),
        bookmarkedChapterIds: bmRes.rows.map((r) => r.chapter_id),
        readingProgress,
        readingGoal: u.reading_goal || buildDefaultReadingGoal(),
        createdAt: new Date(u.created_at).toISOString()
      };
      const existingIdx = this.state.users.findIndex((x) => x.id === hydrated.id || x.email.toLowerCase() === hydrated.email);
      if (existingIdx >= 0) {
        this.state.users[existingIdx] = hydrated;
      } else {
        this.state.users.push(hydrated);
      }
      this.persistSnapshot();
      return hydrated;
    } catch {
      return void 0;
    }
  }
  async findUserById(userId) {
    const cached = this.getUserById(userId);
    if (cached) return cached;
    return this.hydrateSingleUserFromPostgres("id = $1", userId);
  }
  async findUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    const cached = this.getUserByEmail(normalized);
    if (cached) return cached;
    return this.hydrateSingleUserFromPostgres("LOWER(email) = $1", normalized);
  }
  async createUser(name, email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const isOwner = normalizedEmail === getOwnerEmail();
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
    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO users (id, name, email, password_hash, role, reading_goal, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW()) ON CONFLICT (email) DO NOTHING`,
          [record.id, record.name, record.email, record.passwordHash, record.role, JSON.stringify(record.readingGoal)]
        );
        await this.pool.query(
          `INSERT INTO subscriptions (id, user_id, plan, status, amount_ngn)
           VALUES ($1, $2, 'free', 'none', 0) ON CONFLICT (user_id) DO NOTHING`,
          [`sub_${record.id}`, record.id]
        );
      } catch (err) {
        console.error("Failed to mirror user into PostgreSQL:", err);
      }
    }
    this.state.users.push(record);
    this.persistSnapshot();
    return record;
  }
  getStories(options) {
    const includeUnpublished = Boolean(options?.includeUnpublished);
    return this.state.stories.filter((s) => includeUnpublished || (s.publicationStatus || "published") === "published").map((s) => ({
      ...s,
      publicationStatus: s.publicationStatus || "published",
      totalChapters: s.chapters.length
    }));
  }
  getStoryBySlug(slug, options) {
    const story = this.state.stories.find((s) => s.slug === slug);
    if (!story) return void 0;
    const status = story.publicationStatus || "published";
    if (!options?.includeUnpublished && status !== "published") return void 0;
    return { ...story, publicationStatus: status, totalChapters: story.chapters.length };
  }
  getStoryById(storyId) {
    const story = this.state.stories.find((s) => s.id === storyId);
    return story ? { ...story, publicationStatus: story.publicationStatus || "published", totalChapters: story.chapters.length } : void 0;
  }
  hasAccessToChapter(user, story, chapter) {
    const pubStatus = story.publicationStatus || "published";
    if (pubStatus !== "published" && user?.role !== "owner") {
      return false;
    }
    if (chapter.isFree || story.accessTier === "free") return true;
    if (!user) return false;
    if (user.role === "owner") return true;
    if (user.subscription.status === "active" && story.accessTier === "subscription") return true;
    if (user.unlockedStoryIds.includes(story.id)) return true;
    return false;
  }
  addStory(input) {
    const baseSlug = input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "story";
    const slug = this.state.stories.some((s) => s.slug === baseSlug) ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    const id = `story-${Date.now()}`;
    const initialChapterId = `ch-${Date.now()}-1`;
    const initialChapter = {
      id: initialChapterId,
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
    };
    const newStory = {
      ...input,
      id,
      slug,
      publicationStatus: input.publicationStatus || "draft",
      rating: 0,
      ratingsCount: 0,
      totalReads: 0,
      totalChapters: 1,
      chapters: [initialChapter]
    };
    this.state.stories.unshift(newStory);
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO stories (
          id, slug, title, subtitle, author, author_bio, genre, tags, cover_image,
          synopsis, prologue_lore, status, publication_status, access_tier, price_ngn,
          free_chapters_count, featured, updated_at_label
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          newStory.id,
          newStory.slug,
          newStory.title,
          newStory.subtitle,
          newStory.author,
          newStory.authorBio,
          newStory.genre,
          JSON.stringify(newStory.tags),
          newStory.coverImage,
          newStory.synopsis,
          newStory.prologueLore,
          newStory.status,
          newStory.publicationStatus,
          newStory.accessTier,
          newStory.priceNgn,
          newStory.freeChaptersCount,
          newStory.featured,
          newStory.updatedAt
        ]
      );
      await pool.query(
        `INSERT INTO chapters (
          id, story_id, chapter_number, title, slug, release_date_label,
          word_count, read_time_minutes, is_free, excerpt, content
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          initialChapter.id,
          newStory.id,
          initialChapter.chapterNumber,
          initialChapter.title,
          initialChapter.slug,
          initialChapter.releaseDate,
          initialChapter.wordCount,
          initialChapter.readTimeMinutes,
          initialChapter.isFree,
          initialChapter.excerpt,
          JSON.stringify(initialChapter.content)
        ]
      );
    });
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
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO chapters (
          id, story_id, chapter_number, title, slug, release_date_label,
          word_count, read_time_minutes, is_free, excerpt, content
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          newChapter.id,
          storyId,
          newChapter.chapterNumber,
          newChapter.title,
          newChapter.slug,
          newChapter.releaseDate,
          newChapter.wordCount,
          newChapter.readTimeMinutes,
          newChapter.isFree,
          newChapter.excerpt,
          JSON.stringify(newChapter.content)
        ]
      );
      await pool.query("UPDATE stories SET updated_at_label = $1, updated_at = NOW() WHERE id = $2", [
        story.updatedAt,
        storyId
      ]);
    });
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
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        "UPDATE stories SET access_tier = $1, price_ngn = $2, free_chapters_count = $3, updated_at = NOW() WHERE id = $4",
        [story.accessTier, story.priceNgn, story.freeChaptersCount, storyId]
      );
      for (const ch of story.chapters) {
        await pool.query("UPDATE chapters SET is_free = $1 WHERE id = $2", [ch.isFree, ch.id]);
      }
    });
    return story;
  }
  updateStoryWorkflow(storyId, publicationStatus) {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    story.publicationStatus = publicationStatus;
    story.updatedAt = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        "UPDATE stories SET publication_status = $1, updated_at_label = $2, updated_at = NOW() WHERE id = $3",
        [publicationStatus, story.updatedAt, storyId]
      );
    });
    return story;
  }
  toggleBookmark(userId, chapterId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    const exists = user.bookmarkedChapterIds.includes(chapterId);
    user.bookmarkedChapterIds = exists ? user.bookmarkedChapterIds.filter((id) => id !== chapterId) : [...user.bookmarkedChapterIds, chapterId];
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      if (exists) {
        await pool.query("DELETE FROM bookmarks WHERE user_id = $1 AND chapter_id = $2", [userId, chapterId]);
      } else {
        await pool.query(
          "INSERT INTO bookmarks (user_id, chapter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [userId, chapterId]
        );
      }
    });
    return user.bookmarkedChapterIds;
  }
  recordProgress(userId, storyId, chapterId, chapterNumber, progressPercent) {
    const user = this.getUserById(userId);
    if (!user) return null;
    const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
    user.readingProgress[storyId] = {
      chapterId,
      chapterNumber,
      progressPercent: clamped,
      lastReadAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO reading_progress (user_id, story_id, chapter_id, chapter_number, progress_percent, last_read_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, story_id) DO UPDATE SET
           chapter_id = EXCLUDED.chapter_id,
           chapter_number = EXCLUDED.chapter_number,
           progress_percent = EXCLUDED.progress_percent,
           last_read_at = NOW()`,
        [userId, storyId, chapterId, chapterNumber, clamped]
      );
    });
    return user.readingProgress;
  }
  updateReadingGoal(userId, goal) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.readingGoal = goal;
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query("UPDATE users SET reading_goal = $1::jsonb, updated_at = NOW() WHERE id = $2", [
        JSON.stringify(goal),
        userId
      ]);
    });
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
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
    });
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
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO orders (
          id, reference, user_id, customer_email, item_type, plan_id, story_id,
          item_name, amount_ngn, currency, channel, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          order.id,
          order.reference,
          order.userId,
          order.customerEmail,
          order.itemType,
          order.planId ?? null,
          order.storyId ?? null,
          order.itemName,
          order.amountNgn,
          order.currency,
          order.channel,
          order.status
        ]
      );
    });
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
      this.mirrorToPostgres(async (pool) => {
        await pool.query(`UPDATE orders SET status = 'failed' WHERE id = $1`, [order.id]);
      });
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
    let validUntilIso = null;
    if (order.itemType === "subscription") {
      const validUntil = /* @__PURE__ */ new Date();
      if (order.planId === "annual") {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      } else {
        validUntil.setMonth(validUntil.getMonth() + 1);
      }
      validUntilIso = validUntil.toISOString();
      user.subscription = {
        plan: order.planId || "monthly",
        status: "active",
        amountNgn: order.amountNgn,
        validUntil: validUntilIso,
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
    this.mirrorToPostgres(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE orders SET status = 'success', channel = $1, fulfilled_at = NOW() WHERE id = $2`,
          [channel, order.id]
        );
        if (eventId) {
          await client.query(
            `INSERT INTO payment_events (event_id, order_reference, event_type, payload)
             VALUES ($1, $2, 'charge.success', $3::jsonb)
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, order.reference, JSON.stringify({ paidAmountKobo, currency, channel })]
          );
        }
        if (order.itemType === "subscription") {
          await client.query(
            `INSERT INTO subscriptions (id, user_id, plan, status, amount_ngn, valid_until, updated_at)
             VALUES ($1, $2, $3, 'active', $4, $5, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               plan = EXCLUDED.plan,
               status = 'active',
               amount_ngn = EXCLUDED.amount_ngn,
               valid_until = EXCLUDED.valid_until,
               updated_at = NOW()`,
            [`sub_${user.id}`, user.id, order.planId || "monthly", order.amountNgn, validUntilIso]
          );
        } else if (order.itemType === "book_purchase" && order.storyId) {
          await client.query(
            `INSERT INTO entitlements (id, user_id, story_id, source_order_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, story_id) DO NOTHING`,
            [`ent_${crypto.randomUUID()}`, user.id, order.storyId, order.id]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    });
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
      publishedStoriesCount: this.state.stories.filter((s) => (s.publicationStatus || "published") === "published").length,
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
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO highlights (id, user_id, story_id, chapter_id, paragraph_index, excerpt, color, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, chapter_id, paragraph_index) DO UPDATE SET
           excerpt = EXCLUDED.excerpt,
           color = EXCLUDED.color,
           note = EXCLUDED.note`,
        [
          highlight.id,
          userId,
          highlight.storyId,
          highlight.chapterId,
          highlight.paragraphIndex,
          highlight.excerpt,
          highlight.color,
          highlight.note ?? null
        ]
      );
    });
    return existingList;
  }
  deleteHighlight(userId, highlightId) {
    const existingList = this.state.highlights[userId] || [];
    this.state.highlights[userId] = existingList.filter((h) => h.id !== highlightId);
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query("DELETE FROM highlights WHERE id = $1 AND user_id = $2", [highlightId, userId]);
    });
    return this.state.highlights[userId];
  }
  getComments(chapterId) {
    if (!chapterId) return this.state.comments;
    return this.state.comments.filter((c) => c.chapterId === chapterId);
  }
  addComment(comment, userId) {
    this.state.comments.unshift(comment);
    this.persistSnapshot();
    if (userId) {
      this.mirrorToPostgres(async (pool) => {
        await pool.query(
          `INSERT INTO chapter_comments (id, story_id, chapter_id, user_id, author_name, tag, body)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [comment.id, comment.storyId, comment.chapterId, userId, comment.authorName, comment.tag, comment.body]
        );
      });
    }
    return comment;
  }
  deleteComment(commentId, authorName, isOwner) {
    const target = this.state.comments.find((c) => c.id === commentId);
    if (!target) return false;
    if (!isOwner && target.authorName !== authorName) return false;
    this.state.comments = this.state.comments.filter((c) => c.id !== commentId);
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query("DELETE FROM chapter_comments WHERE id = $1", [commentId]);
    });
    return true;
  }
  addInquiry(inquiry) {
    this.state.inquiries.unshift(inquiry);
    this.persistSnapshot();
    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO contacts (id, reference_id, name, email, inquiry_type, subject, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          inquiry.id,
          inquiry.referenceId,
          inquiry.name,
          inquiry.email,
          inquiry.inquiryType,
          inquiry.subject,
          inquiry.message
        ]
      );
    });
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
  if (process.env.VERCEL) {
    const seed = process.env.DATABASE_URL || process.env.PAYSTACK_SECRET_KEY || process.env.GEMINI_API_KEY || process.env.VERCEL_PROJECT_ID || process.env.VERCEL_URL || "lorethos-vercel-fallback";
    return crypto2.createHmac("sha256", "lorethos-session-key").update(seed).digest("hex");
  }
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
function isHttpsRequest(req) {
  if (req.secure) return true;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (proto === "https") return true;
  const origin = String(req.headers.origin || req.headers.referer || "");
  return origin.startsWith("https://");
}
function setSessionCookie(req, res, userId) {
  const token = signSessionToken(userId);
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    isHttps ? "SameSite=None" : "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`
  ];
  if (isHttps) {
    parts.push("Secure", "Partitioned");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
  return token;
}
function clearSessionCookie(req, res) {
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    isHttps ? "SameSite=None" : "SameSite=Lax",
    "Path=/",
    "Max-Age=0"
  ];
  if (isHttps) {
    parts.push("Secure", "Partitioned");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function extractSessionUserId(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    const uid = verifySessionToken(bearerToken);
    if (uid) return uid;
  }
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}
async function getAuthenticatedUserAsync(req) {
  const userId = extractSessionUserId(req);
  if (!userId) return void 0;
  return repo.findUserById(userId);
}
async function requireAuth(req, res, next) {
  const user = await getAuthenticatedUserAsync(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required. Please sign in to continue." });
    return;
  }
  req.currentUser = user;
  next();
}
async function requireOwner(req, res, next) {
  const user = req.currentUser || await getAuthenticatedUserAsync(req);
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
    apiVersion: "v1beta",
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
  console.error("[Gemini API error]", rawMessage);
  let extractedReason = "";
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        extractedReason = parsed.error.message.replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]");
      }
    }
  } catch {
  }
  if (rawMessage.includes("GEMINI_API_KEY is not configured")) {
    return {
      status: 503,
      message: "AI features require a valid API key in Settings > Secrets."
    };
  }
  if (rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message: extractedReason || "AI provider denied this request. Check that your GEMINI_API_KEY in Settings > Secrets is valid and enabled for this model."
    };
  }
  if (rawMessage.includes("400") || rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: extractedReason || "The AI service rejected the API key or request parameters. Please verify Settings > Secrets."
    };
  }
  if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "AI quota reached or paid billing tier required for this model. Check Settings > Secrets for a billing-enabled key."
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
    message: extractedReason || rawMessage.replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]").slice(0, 240) || "Failed to generate AI response. Please try again."
  };
}
function mapPaystackChannel(channel) {
  const c = String(channel || "").toLowerCase();
  if (c === "bank_transfer" || c === "bank" || c === "dedicated_nuban") return "bank_transfer";
  if (c === "ussd") return "ussd";
  return "card";
}
async function createApp(options) {
  await repo.initDatabase();
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
  app.use(express.json({ limit: "12mb" }));
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
  app.get("/api/auth/session", async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: repo.toPublicProfile(user) });
  });
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const trimmedName = String(name || "").trim();
      const trimmedEmail = String(email || "").trim().toLowerCase();
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
      if (await repo.findUserByEmail(trimmedEmail)) {
        res.status(409).json({ error: "An account with this email already exists. Please sign in." });
        return;
      }
      const user = await repo.createUser(trimmedName, trimmedEmail, rawPassword);
      const token = setSessionCookie(req, res, user.id);
      res.status(201).json({ user: repo.toPublicProfile(user), token });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Failed to create account. Please try again." });
    }
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      const trimmedEmail = String(email || "").trim().toLowerCase();
      const rawPassword = String(password || "");
      if (!EMAIL_REGEX.test(trimmedEmail) || !rawPassword) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }
      const user = await repo.findUserByEmail(trimmedEmail);
      if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      const token = setSessionCookie(req, res, user.id);
      res.json({ user: repo.toPublicProfile(user), token });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Failed to sign in. Please try again." });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
  app.get("/api/stories", async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const genre = String(req.query.genre || "All").trim();
    const status = String(req.query.status || "All").trim();
    const tier = String(req.query.tier || "All").trim();
    const sort = String(req.query.sort || "popular").trim();
    const user = await getAuthenticatedUserAsync(req);
    const isOwner = user?.role === "owner";
    let stories = repo.getStories({ includeUnpublished: isOwner }).map(sanitizeStoryForPublic);
    stories = stories.filter((story) => {
      const matchesSearch = !q || story.title.toLowerCase().includes(q) || story.subtitle.toLowerCase().includes(q) || story.author.toLowerCase().includes(q) || story.genre.toLowerCase().includes(q) || story.synopsis.toLowerCase().includes(q) || story.tags.some((t) => t.toLowerCase().includes(q));
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
  app.get("/api/stories/:slug", async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    const story = repo.getStoryBySlug(req.params.slug, {
      includeUnpublished: user?.role === "owner"
    });
    if (!story) {
      res.status(404).json({ error: "Story not found." });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(story) });
  });
  app.get("/api/stories/:slug/chapters/:chapterNumber", async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    const story = repo.getStoryBySlug(req.params.slug, {
      includeUnpublished: user?.role === "owner"
    });
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
    const comment = repo.addComment(
      {
        id: `cmt_${crypto2.randomUUID()}`,
        storyId,
        chapterId,
        authorName: req.currentUser.name,
        tag: safeTag,
        body: cleanedBody,
        createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      },
      req.currentUser.id
    );
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
    const pubStatus = ["draft", "review", "published"].includes(String(body.publicationStatus)) ? body.publicationStatus : "draft";
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
      prologueLore: "Authored in the Lorethos Publishing Desk.",
      status: "Ongoing",
      publicationStatus: pubStatus,
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
  app.patch("/api/admin/stories/:storyId/workflow", requireAuth, requireOwner, (req, res) => {
    const { publicationStatus } = req.body;
    if (!["draft", "review", "published"].includes(String(publicationStatus))) {
      res.status(400).json({ error: "publicationStatus must be draft, review, or published." });
      return;
    }
    const updated = repo.updateStoryWorkflow(req.params.storyId, publicationStatus);
    if (!updated) {
      res.status(404).json({ error: "Story not found." });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(updated) });
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
      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === "owner" }) : void 0;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);
      if (!story || !chapter) {
        res.status(404).json({ error: "Story or chapter could not be found." });
        return;
      }
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
      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === "owner" }) : void 0;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);
      if (!story || !chapter) {
        res.status(404).json({ error: "Story or chapter could not be found." });
        return;
      }
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
      const allowedVoices = /* @__PURE__ */ new Set(["Kore", "Charon", "Puck", "Zephyr", "Fenrir"]);
      const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : "Kore";
      const cappedText = cleaned.slice(0, 2400);
      const intro = `${story.title}. Chapter ${chapter.chapterNumber}: ${chapter.title}.

`;
      const ai = getGeminiClient();
      const interaction = await withTimeout(
        ai.interactions.create({
          model: "gemini-3.8-flash-lite-tts",
          input: [
            {
              type: "text",
              text: `${intro}${cappedText}`,
              annotations: [
                {
                  type: "speech_metadata",
                  style: "Warm, clear, expressive literary audiobook narrator"
                }
              ]
            }
          ],
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [
              {
                language: "en-US",
                voice: selectedVoice
              }
            ]
          }
        }),
        45e3
      );
      const audioPart = interaction.output_audio;
      if (!audioPart?.data) {
        res.status(502).json({ error: "Audio narration was not returned by the model." });
        return;
      }
      res.json({
        audioBase64: audioPart.data,
        mimeType: audioPart.mime_type || "audio/wav",
        voiceName: selectedVoice
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/ai/transcribe", aiLimiter, async (req, res) => {
    try {
      const { audioBase64, mimeType, contextHint } = req.body;
      const cleanedBase64 = String(audioBase64 || "").replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
      if (!cleanedBase64 || cleanedBase64.length < 32) {
        res.status(400).json({ error: "Valid recorded audio is required for transcription." });
        return;
      }
      const rawMime = String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
      const allowedAudioMimes = /* @__PURE__ */ new Set([
        "audio/webm",
        "audio/wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/aac",
        "audio/flac"
      ]);
      const safeMimeType = allowedAudioMimes.has(rawMime) ? rawMime : "audio/webm";
      const safeContext = String(contextHint || "").trim().slice(0, 200);
      const instruction = safeContext ? `Transcribe this spoken literary note clearly and accurately without adding commentary. Context: ${safeContext}` : "Transcribe this spoken audio clearly and accurately without adding commentary.";
      const ai = getGeminiClient();
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.5-transcribe",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeMimeType,
                  data: cleanedBase64
                }
              },
              { text: instruction }
            ]
          }
        }),
        45e3
      );
      res.json({
        transcript: (response.text ?? "").trim()
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });
  app.post("/api/ai/video", aiLimiter, async (req, res) => {
    try {
      const { prompt, aspectRatio, duration, storySlug } = req.body;
      const cleanPrompt = String(prompt || "").trim().slice(0, 600);
      if (cleanPrompt.length < 6) {
        res.status(400).json({ error: "Please describe the video scene in at least 6 characters." });
        return;
      }
      if (aspectRatio && aspectRatio !== "16:9" && aspectRatio !== "9:16") {
        res.status(400).json({ error: "Aspect ratio must be either 16:9 or 9:16." });
        return;
      }
      const safeAspectRatio = aspectRatio === "9:16" ? "9:16" : "16:9";
      const safeDuration = duration === "6s" ? "6s" : "10s";
      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === "owner" }) : void 0;
      if (storySlug && !story) {
        res.status(404).json({ error: "Referenced story was not found." });
        return;
      }
      const cinematicInput = story ? `Atmospheric literary book trailer inspired by "${story.title}" (${story.genre}): ${cleanPrompt}` : cleanPrompt;
      const ai = getGeminiClient();
      const interaction = await withTimeout(
        ai.interactions.create(
          {
            model: "gemini-omni-1.2-flash",
            input: cinematicInput,
            background: false,
            store: false,
            stream: false,
            response_format: {
              type: "video",
              aspect_ratio: safeAspectRatio,
              duration: safeDuration,
              resolution: "720p"
            }
          },
          { timeout: 3e5 }
        ),
        3e5
      );
      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data && !videoPart.uri) {
        res.status(502).json({ error: "The model completed without returning a video clip." });
        return;
      }
      res.json({
        videoBase64: videoPart.data || null,
        videoUri: videoPart.uri || null,
        mimeType: videoPart.mime_type || "video/mp4",
        aspectRatio: safeAspectRatio,
        duration: safeDuration
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
  if ((options?.withVite ?? true) && process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const hmrDisabled = process.env.DISABLE_HMR === "true" || Boolean(process.env.K_SERVICE && process.env.APPLET_ID);
    const vite = await createViteServer({
      plugins: hmrDisabled ? [
        {
          name: "lorethos-disable-hmr-ws",
          transform(code, id) {
            const cleanId = id.split("?", 1)[0];
            if (cleanId.endsWith("/vite/dist/client/client.mjs") || cleanId.endsWith("/@vite/client")) {
              return code.replace(
                "transport.connect(createHMRHandler(handleMessage));",
                "/* HMR WebSocket disabled */"
              );
            }
            return null;
          }
        }
      ] : [],
      server: {
        middlewareMode: true,
        port: PORT,
        allowedHosts: true,
        ...hmrDisabled ? { hmr: false, ws: false, watch: null } : { ws: options?.httpServer ? { server: options.httpServer } : false }
      },
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
  return app;
}
var isDirectExecution = !process.env.LORETHOS_NO_LISTEN && !process.env.VERCEL;
if (isDirectExecution) {
  const httpServer = http.createServer();
  createApp({ withVite: process.env.NODE_ENV !== "production", httpServer }).then((app) => {
    httpServer.on("request", app);
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Lorethos server listening on http://0.0.0.0:${PORT}`);
    });
  }).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
export {
  createApp
};
