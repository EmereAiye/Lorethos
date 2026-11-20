import { PaymentTransaction, Story } from '../types';

// Sanitized public fallback catalog: paid (!isFree) chapters NEVER include full prose in client bundle.
export const INITIAL_STORIES: Story[] = [
  {
    id: 'story-obsidian-throne',
    slug: 'the-obsidian-throne',
    title: 'The Obsidian Throne',
    subtitle: 'An Epic Dark Fantasy of Sovereignty, Ash, and Royal Reckoning',
    author: 'Elara Kavanagh',
    authorBio: 'Fabulist and folklorist exploring dynastic mythologies and high-court political intrigue.',
    genre: 'Epic Fantasy',
    tags: ['Dark Fantasy', 'Monarchy', 'Ancient Magic', 'Political Intrigue'],
    coverImage: '/assets/images/book_cover_obsidian_throne_1794465561565.jpg',
    synopsis: 'When the High Citadels of Ostraka crumble under the shadow of the Black Eclipse, King Vane must summon an ancient blood-pact bound to the Obsidian Throne. Betrayal lurks behind velvet banners, and each decree carves a deeper fracture in the realm.',
    prologueLore: 'Before the nine pillars fell, there existed only the Primordial Hearth. The kings of the First Spire forged their crowns not of gold, but of quenched astral glass plucked from the crater of Mount Veridia.',
    status: 'Ongoing',
    accessTier: 'subscription',
    priceNgn: 2800,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 5,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 1,
    updatedAt: 'Oct 2026',
    trailerVideoUrl: '/assets/trailers/the-obsidian-throne.mp4',
    trailerPosterUrl: '/assets/images/trailers/the-obsidian-throne.jpg',
    trailerDuration: '21s',
    trailerMood: 'action',
    trailerNarration: 'As the Black Eclipse darkens Ostraka, King Vane confronts rising warlords and court betrayal. Bound to an ancient blood-pact, every decree threatens the realm. Read The Obsidian Throne on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'Eclipse Over Ostraka',
        mood: 'storm',
        moodLabel: 'Storm',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/the-obsidian-throne.jpg',
        caption: 'Violet twilight falls across the obsidian ramparts.'
      },
      {
        sceneNumber: 2,
        title: 'Vault of the First Weavers',
        mood: 'suspense',
        moodLabel: 'Suspense',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/the-obsidian-throne-s2.jpg',
        caption: 'Glowing clay tablets thrum beneath the citadel.'
      },
      {
        sceneNumber: 3,
        title: 'The Iron Covenant',
        mood: 'action',
        moodLabel: 'Action',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/the-obsidian-throne-s3.jpg',
        caption: 'Twelve warlords swear beside roaring Great Hall hearths.'
      }
    ],
    chapters: [
      {
        id: 'ch-obsidian-1',
        storyId: 'story-obsidian-throne',
        chapterNumber: 1,
        title: 'The Eclipse Over Ostraka',
        slug: 'the-eclipse-over-ostraka',
        releaseDate: 'Oct 14, 2026',
        wordCount: 2450,
        readTimeMinutes: 9,
        isFree: true,
        excerpt: 'The bells of the High Scriptorium tolled seven minutes before noon, not to signal prayer, but to herald the dying of the sun.',
        content: [
          'The bells of the High Scriptorium tolled seven minutes before noon, not to signal prayer, but to herald the dying of the sun.',
          'High above the obsidian ramparts, King Vane stood draped in mantle of boiled stag-hide and hammered bronze. The wind whipping across the northern steppes carried the bitter scent of sulfur and wet granite. Below, ten thousand silent citizens watched the sky curdle into violet dusk.',
          '"Your Grace," whispered Chancellor Morwen, his hand trembling as he tucked a ceremonial parchment into his silk sashes. "The astrologers swear the celestial ring is passing directly through the Fourth House. If the ward stones ignite tonight, the lower garrison will drown in violet flame."',
          'Vane did not turn. His gaze remained locked on the blackened disc consuming the solar corona. A solitary ring of blinding golden embers remained, suspended like a crown of thorns above the shattered continent.',
          '"Let the lower gates remain open," Vane commanded, his voice measured, hollowed by three decades of quiet wars. "If the ancient pact demands a tithe, let the heavens look upon men who refuse to kneel in the dark."',
          'A murmur rippled along the battlements. Far below, in the sunken sanctuaries beneath the foundation stones, the first hymn began to rise—a guttural, primordial chant passed down from ancestors who walked before the stars had names.'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-obsidian-2',
        storyId: 'story-obsidian-throne',
        chapterNumber: 2,
        title: 'The Scribe of the Lower Vault',
        slug: 'the-scribe-of-the-lower-vault',
        releaseDate: 'Oct 21, 2026',
        wordCount: 3100,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: 'In the ink-stained catacombs beneath Ostraka, records were kept of things that the Citadel chose to forget.',
        content: [
          'In the ink-stained catacombs beneath Ostraka, records were kept of things that the Citadel chose to forget.',
          'Lady Sylva wiped charcoal dust from her knuckles and peered down at the clay tablet resting on her walnut lectern. The cuneiform indentations were still warm to the touch, vibrating with a low harmonic thrum that rattled the amber oil lamps.',
          '"They told us the Obsidian King died without heir three centuries ago," she murmured to the apprentice waiting in the shadows of the arched colonnade.',
          '"And yet," the youth whispered back, his breath misting in the cold subterranean draft, "the royal crest on the western gate is weeping fresh pine resin. The wood remembers who carved it."',
          'Sylva traced the carved contour of an interlocking monogram: the LT sigil, mark of the First Weavers. Legends warned that when the sigil breathed anew, the boundary between mortal ambition and mythological destiny would dissolve like dew upon a heated blade.'
        ],
        ambientSoundscape: 'rain'
      },
      {
        id: 'ch-obsidian-3',
        storyId: 'story-obsidian-throne',
        chapterNumber: 3,
        title: 'The Iron Covenant',
        slug: 'the-iron-covenant',
        releaseDate: 'Oct 28, 2026',
        wordCount: 2890,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'Twelve warlords arrived by midnight, each bearing a jar of soil dug from the border of their ancestral lands.',
        content: [
          'Twelve warlords arrived by midnight, each bearing a jar of soil dug from the border of their ancestral lands.',
          'The Great Hall was cold despite the roaring hearths. Banners of faded vermilion and soot-black velvet hung from rafters carved in the likeness of sleeping serpents.',
          '"We did not ride through the salt flats to swear fealty to an empty chair," declared Lord Kaelen, slamming a clay vessel onto the basalt table until the loam spilled across the polished stone.',
          'Vane stepped out from behind the dais shadows. He wore no crown, only a torque of coiled iron about his collarbone.',
          '"The chair is not empty, Kaelen," the King replied softly. "You simply cannot see the ghosts that occupy it."'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-obsidian-4',
        storyId: 'story-obsidian-throne',
        chapterNumber: 4,
        title: 'The Trial of Ashen Waters',
        slug: 'the-trial-of-ashen-waters',
        releaseDate: 'Nov 04, 2026',
        wordCount: 3400,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: 'The deep subterranean lake gave off a phosphorescent mist, shimmering with the memories of those who dared drink from its basin.',
        content: [],
        ambientSoundscape: 'mythic_drone'
      },
      {
        id: 'ch-obsidian-5',
        storyId: 'story-obsidian-throne',
        chapterNumber: 5,
        title: 'Whispers Beneath the Dais',
        slug: 'whispers-beneath-the-dais',
        releaseDate: 'Nov 11, 2026',
        wordCount: 3200,
        readTimeMinutes: 11,
        isFree: false,
        excerpt: 'A silent coup does not begin with poisoned chalices, but with rewritten histories.',
        content: []
      }
    ]
  },
  {
    id: 'story-whispering-savanna',
    slug: 'whisper-of-the-baobab',
    title: 'Whisper of the Baobab',
    subtitle: 'Mythological Realism, Astral Nomads, and the Starlit Desert',
    author: 'Ama Achebe',
    authorBio: 'Novelist and mythological scholar based between Nigeria and Oxford, exploring West African folklore, astral navigation, and speculative ancestral wisdom.',
    genre: 'Mythological Realism',
    tags: ['Afrofuturism', 'Ancestral Lore', 'Folklore', 'Cosmic Journey'],
    coverImage: '/assets/images/book_cover_whispering_savanna_1794465562207.jpg',
    synopsis: 'Under the cosmic expanse of the Sahel night, young navigator Boma is chosen to carry the ancestral seed across the singing sands. When the ancient Baobab tree illuminates with celestial runes, she discovers her ancestors did not merely observe the stars—they built highways between them.',
    prologueLore: 'In the beginning, when the earth was red clay drying under the midday breath of Olorun, the first grandmother planted her brass hairpin into the cracked mud. By sundown, it had grown roots of thunder and branches of indigo sky.',
    status: 'Ongoing',
    accessTier: 'subscription',
    priceNgn: 2500,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 2,
    updatedAt: 'Sep 2026',
    trailerVideoUrl: '/assets/trailers/whisper-of-the-baobab.mp4',
    trailerPosterUrl: '/assets/images/trailers/whisper-of-the-baobab.jpg',
    trailerDuration: '21s',
    trailerMood: 'neutral',
    trailerNarration: 'Chosen to carry an ancestral brass compass across the Sahel sands, Boma awakens a starlit Baobab—discovering celestial highways built by her forebears. Read Whisper of the Baobab now on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'The Luminous Baobab',
        mood: 'neutral',
        moodLabel: 'Calm Drift',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/whisper-of-the-baobab.jpg',
        caption: 'Cobalt runes awaken beneath the Sahel night sky.'
      },
      {
        sceneNumber: 2,
        title: 'The Singing Sands',
        mood: 'action',
        moodLabel: 'Wind & Pulse',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/whisper-of-the-baobab-s2.jpg',
        caption: 'Crossing the humming crimson dunes toward the horizon.'
      },
      {
        sceneNumber: 3,
        title: 'The Starlit Oasis',
        mood: 'neutral',
        moodLabel: 'Starlight',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/whisper-of-the-baobab-s3.jpg',
        caption: 'Mirrored waters reflect constellations of another sky.'
      }
    ],
    chapters: [
      {
        id: 'ch-baobab-1',
        storyId: 'story-whispering-savanna',
        chapterNumber: 1,
        title: 'The Brass Compass of Azar',
        slug: 'the-brass-compass-of-azar',
        releaseDate: 'Sep 05, 2026',
        wordCount: 2800,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'The compass did not point north; it pointed toward the nearest place where a living ancestor had drawn their final breath.',
        content: [
          'The compass did not point north; it pointed toward the nearest place where a living ancestor had drawn their final breath.',
          'Boma held the instrument cupped in both palms. The brass casing was cool against her feverish skin, inscribed with intricate knotwork reminiscent of ancient terracotta vessels unearthed along the Niger riverbanks.',
          'Behind her, the village of Kundi was already folding up its indigo canopies. The elder caravan leaders spoke in low, hushed tones, eyeing the southern horizon where the dunes were glowing with a strange opalescent luminescence.',
          '"The baobab has spoken thrice this moon," Elder Tari said, limping to her side with his carved mahogany staff. "The first time it whispered of droughts. The second time it wept salt. But tonight... tonight its trunk shines with the script of the Sky People."',
          'Boma looked up at the colossal tree towering at the center of the desert basin. Its trunk, wider than twenty men with arms outstretched, was veined with pale cobalt light, pulsing in rhythm with her own heartbeat.'
        ],
        ambientSoundscape: 'mythic_drone'
      },
      {
        id: 'ch-baobab-2',
        storyId: 'story-whispering-savanna',
        chapterNumber: 2,
        title: 'The Singing Sands of Kundi',
        slug: 'the-singing-sands-of-kundi',
        releaseDate: 'Sep 12, 2026',
        wordCount: 3100,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: 'When the wind rises between the crests of the red dunes, the sand hums in five distinct polyrhythms.',
        content: [
          'When the wind rises between the crests of the red dunes, the sand hums in five distinct polyrhythms.',
          'Boma walked with her feet bare against the cool evening crust. Each step sent subtle ripples of silver light through the grains, like phosphorus stirred in a tropical lagoon.',
          '"Walk with the tempo of your grandmother\'s loom," Elder Tari had instructed her before she crossed the village boundary stone. "If you hurry, the desert thinks you are fleeing, and it swallows what runs."',
          'In the distance, three twin moons hung in a serene celestial triangle, reflecting off the salt flats like dropped coins of silver.'
        ],
        ambientSoundscape: 'rain'
      },
      {
        id: 'ch-baobab-3',
        storyId: 'story-whispering-savanna',
        chapterNumber: 3,
        title: 'Runes of the First Weavers',
        slug: 'runes-of-the-first-weavers',
        releaseDate: 'Sep 19, 2026',
        wordCount: 2950,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'Touching the bark felt like pressing one\'s ear against a sleeping giant\'s ribcage.',
        content: [
          'Touching the bark felt like pressing one\'s ear against a sleeping giant\'s ribcage.',
          'The runes glowed brighter beneath Boma\'s fingertips, spiraling upward along the gnarled bark into the crown of stars.',
          'Words formed not in the air, but inside the marrow of her bones: "Return what was stolen before the dry season closes the throat of the sky."'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-baobab-4',
        storyId: 'story-whispering-savanna',
        chapterNumber: 4,
        title: 'The Starlit Oasis',
        slug: 'the-starlit-oasis',
        releaseDate: 'Sep 26, 2026',
        wordCount: 3300,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: 'Deep in the forbidden hollow, the water did not reflect the sky above, but the sky on the opposite hemisphere of the world.',
        content: []
      }
    ]
  },
  {
    id: 'story-sunken-epoch',
    slug: 'chronicles-of-the-sunken-epoch',
    title: 'Chronicles of the Sunken Epoch',
    subtitle: 'Sunken Citadels, Lost Archeology, and the Relics of the Deep',
    author: 'Elara Vance',
    authorBio: 'Maritime archaeologist and speculative fiction author whose work combines deep-sea oceanography with ancient forgotten civilizations.',
    genre: 'Lost Epoch & Sci-Fi',
    tags: ['Submerged Worlds', 'Ancient Relics', 'Ocean Mythos', 'Archaeology'],
    coverImage: '/assets/images/book_cover_sunken_epoch_1794465563519.jpg',
    synopsis: 'Miles beneath the crashing storms of the Cerulean Trench lies Atal-Mor, a submerged metropolis preserved in a glowing abyssal bubble. Diver Captain Kaelen uncovers an ornate golden reliquary containing the living memory of a drowned world—and the warning that the ocean is rising again.',
    prologueLore: 'The waters did not take Atal-Mor out of wrath. They took it out of longing. When humanity turned its eyes solely toward fire and iron, the oceans rose to cradle the temples of philosophy in perpetual blue repose.',
    status: 'Completed',
    accessTier: 'purchase',
    priceNgn: 3200,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 3,
    updatedAt: 'Jul 2026',
    trailerVideoUrl: '/assets/trailers/chronicles-of-the-sunken-epoch.mp4',
    trailerPosterUrl: '/assets/images/trailers/chronicles-of-the-sunken-epoch.jpg',
    trailerDuration: '21s',
    trailerMood: 'storm',
    trailerNarration: 'Four thousand fathoms beneath ocean storms, diver Kaelen uncovers drowned Atal-Mor—and a golden reliquary warning that the sea is rising again. Read the full chronicle on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'The Cerulean Trench',
        mood: 'storm',
        moodLabel: 'Deep Storm',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/chronicles-of-the-sunken-epoch.jpg',
        caption: 'Hull beams pierce four thousand fathoms into Atal-Mor.'
      },
      {
        sceneNumber: 2,
        title: 'Reliquary of Living Light',
        mood: 'suspense',
        moodLabel: 'Suspense',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/chronicles-of-the-sunken-epoch-s2.jpg',
        caption: 'Carved amber projects ancient script into the abyss.'
      },
      {
        sceneNumber: 3,
        title: 'Breach in the Dome',
        mood: 'storm',
        moodLabel: 'Tempest',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/chronicles-of-the-sunken-epoch-s3.jpg',
        caption: 'A crystal fracture threatens the sunken archive.'
      }
    ],
    chapters: [
      {
        id: 'ch-sunken-1',
        storyId: 'story-sunken-epoch',
        chapterNumber: 1,
        title: 'Descent into the Cerulean Trench',
        slug: 'descent-into-the-cerulean-trench',
        releaseDate: 'Jul 10, 2026',
        wordCount: 3200,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: 'At four thousand fathoms, darkness is not the absence of light; it is a heavy living fabric that presses against your dive-suit glass.',
        content: [
          'At four thousand fathoms, darkness is not the absence of light; it is a heavy living fabric that presses against your dive-suit glass.',
          'Kaelen watched the depth gauge spin past the danger threshold. The brass dial on his forearm hissed as pneumatic seals adjusted to the crushing pressure.',
          'Then, suddenly, the hull lights of his dive vessel caught a gleam of polished marble.',
          'Colossal statues of crowned deities, thirty meters tall, stood in silent procession along an underwater avenue. Between them swam schools of glowing lantern fish, darting like sparks through the sunken colonnades of Atal-Mor.'
        ],
        ambientSoundscape: 'rain'
      },
      {
        id: 'ch-sunken-2',
        storyId: 'story-sunken-epoch',
        chapterNumber: 2,
        title: 'The Reliquary of Living Light',
        slug: 'the-reliquary-of-living-light',
        releaseDate: 'Jul 17, 2026',
        wordCount: 2900,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'The golden casket rested upon a pedestal of carved sea-serpents, untouched by barnacles or marine decay.',
        content: [
          'The golden casket rested upon a pedestal of carved sea-serpents, untouched by barnacles or marine decay.',
          'When Kaelen\'s gloved hand brushed the latch, the reliquary opened of its own accord. A warm, golden luminescence bloomed outward, banishing the abyssal chill.',
          'Within the velvet interior lay an egg of carved amber, rotating without wire or pivot, projecting holographic scripts of an ancient alphabet into the water.'
        ]
      },
      {
        id: 'ch-sunken-3',
        storyId: 'story-sunken-epoch',
        chapterNumber: 3,
        title: 'Voices of the Drowned Council',
        slug: 'voices-of-the-drowned-council',
        releaseDate: 'Jul 24, 2026',
        wordCount: 3050,
        readTimeMinutes: 11,
        isFree: true,
        excerpt: 'The amber spoke not in sound waves, but directly into the sonar receiver of his helmet.',
        content: [
          'The amber spoke not in sound waves, but directly into the sonar receiver of his helmet.',
          '"We who slumber in the deep do not ask for salvation," the chorus resonated. "We ask only that you do not repeat the arrogance of the sun-kings who burned the sky."'
        ]
      },
      {
        id: 'ch-sunken-4',
        storyId: 'story-sunken-epoch',
        chapterNumber: 4,
        title: 'Breach in the Pressure Dome',
        slug: 'breach-in-the-pressure-dome',
        releaseDate: 'Jul 31, 2026',
        wordCount: 3500,
        readTimeMinutes: 13,
        isFree: false,
        excerpt: 'A hairline fracture appeared in the atmospheric crystal keeping the central library dry for three millennia.',
        content: []
      }
    ]
  },
  {
    id: 'story-crimson-scribe',
    slug: 'the-crimson-scribe',
    title: 'The Crimson Scribe',
    subtitle: 'Palace Intrigue, Secret Manuscripts, and the Poisoned Quills of Veritas',
    author: 'Evelyn St. Claire',
    authorBio: 'Historian and novelist specializing in Renaissance cryptography, clandestine manuscripts, and the secret diplomacy of sovereign courts.',
    genre: 'Historical Mystery',
    tags: ['Palace Mystery', 'Manuscripts', 'Secret Societies', 'Renaissance Noir'],
    coverImage: '/assets/images/book_cover_crimson_dynasty_1794465562273.jpg',
    synopsis: 'In the grand royal scriptorium of House Valerius, every royal decree is written in red squid ink. But when apprentice copyist Lucien discovers a parchment with an encrypted ledger hidden between illuminated vellum pages, he realizes the last three kings were not assassinated by neighboring empires—they were executed by their own royal scribes.',
    prologueLore: 'The ink never lies, but the scribe may dip his quill in poison as easily as in gall. In Veritas, power resides not with the prince who speaks, but with the quiet clerk who transcribes his words for posterity.',
    status: 'Ongoing',
    accessTier: 'subscription',
    priceNgn: 2200,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 4,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: true,
    spotlightOrder: 4,
    updatedAt: 'Sep 2026',
    trailerVideoUrl: '/assets/trailers/the-crimson-scribe.mp4',
    trailerPosterUrl: '/assets/images/trailers/the-crimson-scribe.jpg',
    trailerDuration: '21s',
    trailerMood: 'suspense',
    trailerNarration: 'In the royal scriptorium of House Valerius, apprentice Lucien decodes a cipher in crimson ink—revealing three kings were executed by their own scribes. Read more on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'The Gall of Veritas',
        mood: 'suspense',
        moodLabel: 'Suspense',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/the-crimson-scribe.jpg',
        caption: 'Crimson cochineal ink steams inside the scriptorium.'
      },
      {
        sceneNumber: 2,
        title: 'Cipher in the Margins',
        mood: 'suspense',
        moodLabel: 'Cipher Pulse',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/the-crimson-scribe-s2.jpg',
        caption: 'Candlelight reveals coordinates pierced into vellum.'
      },
      {
        sceneNumber: 3,
        title: 'Night of the Silent Wax',
        mood: 'storm',
        moodLabel: 'Rain & Tension',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/the-crimson-scribe-s3.jpg',
        caption: 'Lantern beams sweep rain-slicked courtyard stones.'
      }
    ],
    chapters: [
      {
        id: 'ch-scribe-1',
        storyId: 'story-crimson-scribe',
        chapterNumber: 1,
        title: 'The Gall of House Valerius',
        slug: 'the-gall-of-house-valerius',
        releaseDate: 'Aug 14, 2026',
        wordCount: 2600,
        readTimeMinutes: 9,
        isFree: true,
        excerpt: 'To mix the royal red ink, one must boil crushed cochineal beetles with aged vinegar and iron salts until the fumes burn the throat.',
        content: [
          'To mix the royal red ink, one must boil crushed cochineal beetles with aged vinegar and iron salts until the fumes burn the throat.',
          'Lucien stirred the copper cauldron with a cedar dowel, watching the liquid transition from rust to brilliant arterial crimson.',
          'The scriptorium was silent except for the rhythmic scratching of thirty goose-quill pens on calfskin vellum. Outside the high arched stained-glass windows, rain swept across the slate roofs of the capital.',
          '"Master Corvin," Lucien whispered, stepping toward the chief archivist\'s mahogany desk. "The missive from the Duke of Morveau contains a date that contradicts the treaty signed last winter."',
          'Corvin looked up slowly, his cataract-clouded eyes narrowing. "In this room, Lucien, dates are not facts. Dates are instruments of statecraft. Copy what is written, or let the ink find another hand."'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-scribe-2',
        storyId: 'story-crimson-scribe',
        chapterNumber: 2,
        title: 'Cipher in the Margins',
        slug: 'cipher-in-the-margins',
        releaseDate: 'Aug 21, 2026',
        wordCount: 2900,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'Microscopic punctures along the floral border of the Psalms formed a grid of coordinates.',
        content: [
          'Microscopic punctures along the floral border of the Psalms formed a grid of coordinates.',
          'Lucien held the leaf against the candle flame. The pinpricks glowed like stars in a miniature constellation, aligning precisely with the names of the five royal tasters.'
        ]
      },
      {
        id: 'ch-scribe-3',
        storyId: 'story-crimson-scribe',
        chapterNumber: 3,
        title: 'The Archivist\'s Last Will',
        slug: 'the-archivists-last-will',
        releaseDate: 'Aug 28, 2026',
        wordCount: 2750,
        readTimeMinutes: 10,
        isFree: true,
        excerpt: 'Corvin was found slumped over his desk at dawn, his lips stained with the very ink he had guarded for fifty years.',
        content: [
          'Corvin was found slumped over his desk at dawn, his lips stained with the very ink he had guarded for fifty years.',
          'In his stiffened fingers, he clutched a wax seal depicting the Lorethos double-headed quill.'
        ]
      },
      {
        id: 'ch-scribe-4',
        storyId: 'story-crimson-scribe',
        chapterNumber: 4,
        title: 'The Night of the Silent Wax',
        slug: 'the-night-of-the-silent-wax',
        releaseDate: 'Sep 04, 2026',
        wordCount: 3300,
        readTimeMinutes: 12,
        isFree: false,
        excerpt: 'Every door in the scriptorium was bolted from the outside as footsteps echoed along the flagstones.',
        content: []
      }
    ]
  },
  {
    id: 'story-harmattan-verses',
    slug: 'verses-of-the-harmattan',
    title: 'Verses of the Harmattan',
    subtitle: 'Collected Poems of Dust, Brass Lanterns, and Atlantic Dusk',
    author: 'Kemi Adeyemi',
    authorBio: 'Poet and essayist writing between Lagos and Accra, exploring memory, seasonal winds, and oral lyricism.',
    genre: 'Poetry',
    tags: ['Poetry', 'Lyric Verse', 'Oral Tradition', 'Anthology'],
    coverImage: '/assets/images/book_cover_whispering_savanna_1794465562207.jpg',
    synopsis: 'A serialized poetry anthology tracing the dry northern wind from Sahelian courtyards to coastal harbors—meditations on longing, kinship, and light surviving dust.',
    prologueLore: 'Each installment gathers three rhythmic cantos meant to be read slowly aloud at dusk.',
    status: 'Ongoing',
    accessTier: 'free',
    priceNgn: 0,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 3,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: false,
    spotlightOrder: 5,
    updatedAt: 'Nov 2026',
    trailerVideoUrl: '/assets/trailers/verses-of-the-harmattan.mp4',
    trailerPosterUrl: '/assets/images/trailers/verses-of-the-harmattan.jpg',
    trailerDuration: '21s',
    trailerMood: 'neutral',
    trailerNarration: 'Tracing the Harmattan wind from ochre courtyards to Atlantic harbors, this poetry anthology weaves memory, kinship, and lantern light into evening verse. Read every canto free on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'When Red Dust Arrives',
        mood: 'neutral',
        moodLabel: 'Amber Breeze',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/verses-of-the-harmattan.jpg',
        caption: 'Ochre sunrise dust settles across brass veranda lamps.'
      },
      {
        sceneNumber: 2,
        title: 'Elegy for the Ferryman',
        mood: 'suspense',
        moodLabel: 'Twilight Tide',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/verses-of-the-harmattan-s2.jpg',
        caption: 'Warm harbor lights linger above the dusk lagoon.'
      },
      {
        sceneNumber: 3,
        title: 'Starlight on Tin Roofs',
        mood: 'neutral',
        moodLabel: 'Night Chorus',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/verses-of-the-harmattan-s3.jpg',
        caption: 'Constellations bloom radiant above cooling tin eaves.'
      }
    ],
    chapters: [
      {
        id: 'ch-harmattan-1',
        storyId: 'story-harmattan-verses',
        chapterNumber: 1,
        title: 'I. When the Red Dust Arrives',
        slug: 'when-the-red-dust-arrives',
        releaseDate: 'Oct 18, 2026',
        wordCount: 420,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: 'At dawn the mango leaves wore a thin coat of ochre, and every door remembered the desert.',
        content: [
          'At dawn the mango leaves wore a thin coat of ochre, and every door remembered the desert.',
          'We lit the brass lantern before sunrise, watching silver motes drift across the veranda like unspoken letters.',
          'Dry wind carries no rain, yet it softens every hard edge of the city into amber quiet—a truce between yesterday and bloom.'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-harmattan-2',
        storyId: 'story-harmattan-verses',
        chapterNumber: 2,
        title: 'II. Elegy for the Ferryman',
        slug: 'elegy-for-the-ferryman',
        releaseDate: 'Oct 25, 2026',
        wordCount: 390,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: 'His wooden oar measured the tide better than any clock in the harbor tower.',
        content: [
          'His wooden oar measured the tide better than any clock in the harbor tower.',
          'Salt and cedar smoke lingered on his coat; he spoke only in gentle proverbs about patience and returning water.',
          'Now the lagoon keeps his cadence in the hush between evening bells.'
        ],
        ambientSoundscape: 'rain'
      },
      {
        id: 'ch-harmattan-3',
        storyId: 'story-harmattan-verses',
        chapterNumber: 3,
        title: 'III. Starlight on Tin Roofs',
        slug: 'starlight-on-tin-roofs',
        releaseDate: 'Nov 02, 2026',
        wordCount: 460,
        readTimeMinutes: 3,
        isFree: true,
        excerpt: 'Night cools the corrugated iron until the whole street sings with tiny metallic sighs.',
        content: [
          'Night cools the corrugated iron until the whole street sings with tiny metallic sighs.',
          'Above the courtyard, constellations bloom clear and radiant through the thinning haze, reminding us how small our quarrels are beneath an eternal sky.'
        ],
        ambientSoundscape: 'mythic_drone'
      }
    ]
  },
  {
    id: 'story-lagoon-letters',
    slug: 'letters-across-the-lagoon',
    title: 'Letters Across the Lagoon',
    subtitle: 'An Epistolary Novel of Two Architects Rebuilding a Waterfront Library',
    author: 'Tunde Babalola',
    authorBio: 'Fiction writer and urban chronicler focusing on memory, architecture, and quiet human resilience.',
    genre: 'Literary Fiction',
    tags: ['Fiction', 'Epistolary', 'Contemporary', 'Drama'],
    coverImage: '/assets/images/book_cover_sunken_epoch_1794465563519.jpg',
    synopsis: 'Separated by a decade of silence and a contested waterfront restoration, two former partners exchange handwritten letters tucked inside architectural blueprints—uncovering what happened the night the old reading hall burned.',
    prologueLore: 'Every chapter pairs one unsent draft with the letter that finally crossed the water.',
    status: 'Completed',
    accessTier: 'free',
    priceNgn: 0,
    rating: 0,
    ratingsCount: 0,
    totalChapters: 3,
    totalReads: 0,
    freeChaptersCount: 3,
    featured: false,
    spotlightOrder: 6,
    updatedAt: 'Nov 2026',
    trailerVideoUrl: '/assets/trailers/letters-across-the-lagoon.mp4',
    trailerPosterUrl: '/assets/images/trailers/letters-across-the-lagoon.jpg',
    trailerDuration: '21s',
    trailerMood: 'neutral',
    trailerNarration: 'After ten years of silence, two estranged architects exchange handwritten letters tucked inside waterfront blueprints—rebuilding a burned reading hall while uncovering the truth of the night it fell. Read Letters Across the Lagoon free on Lorethos.',
    trailerScenes: [
      {
        sceneNumber: 1,
        title: 'Blueprint in Blue Ink',
        mood: 'neutral',
        moodLabel: 'Harbor Calm',
        startSec: 0,
        endSec: 7,
        imageUrl: '/assets/images/trailers/letters-across-the-lagoon.jpg',
        caption: 'Rolled waterfront elevations return across the tide.'
      },
      {
        sceneNumber: 2,
        title: 'The Salt-Stained Ledger',
        mood: 'suspense',
        moodLabel: 'Archive Secret',
        startSec: 7,
        endSec: 14,
        imageUrl: '/assets/images/trailers/letters-across-the-lagoon-s2.jpg',
        caption: 'Hidden beneath floorboards lies truth from ten winters ago.'
      },
      {
        sceneNumber: 3,
        title: 'Opening the Timber Windows',
        mood: 'action',
        moodLabel: 'Sunlit Rebirth',
        startSec: 14,
        endSec: 21,
        imageUrl: '/assets/images/trailers/letters-across-the-lagoon-s3.jpg',
        caption: 'Golden afternoon sun floods fresh cedar shelves.'
      }
    ],
    chapters: [
      {
        id: 'ch-lagoon-1',
        storyId: 'story-lagoon-letters',
        chapterNumber: 1,
        title: 'Blueprint in Blue Ink',
        slug: 'blueprint-in-blue-ink',
        releaseDate: 'Oct 10, 2026',
        wordCount: 1850,
        readTimeMinutes: 7,
        isFree: true,
        excerpt: 'You left your compass on the drafting table, as if you expected the tide to wait for our second draft.',
        content: [
          'You left your compass on the drafting table, as if you expected the tide to wait for our second draft.',
          'The ferry from Tarkwa Bay still shakes at the pier every morning at seven. I carried your rolled elevations up the timber stairs and spread them across the long mahogany desk.',
          'Someone had circled the west reading terrace in faint red pencil—the exact corner where the roof timbers gave way ten winters ago.'
        ],
        ambientSoundscape: 'rain'
      },
      {
        id: 'ch-lagoon-2',
        storyId: 'story-lagoon-letters',
        chapterNumber: 2,
        title: 'The Salt-Stained Ledger',
        slug: 'the-salt-stained-ledger',
        releaseDate: 'Oct 17, 2026',
        wordCount: 1920,
        readTimeMinutes: 8,
        isFree: true,
        excerpt: 'Truth rarely arrives in grand speeches; mostly it hides in margin notes and forgotten invoices.',
        content: [
          'Truth rarely arrives in grand speeches; mostly it hides in margin notes and forgotten invoices.',
          'Inside the archive drawer beneath the floorboards, Ada found the contractor receipt dated two days before the fire—signed by a councilman who swore he had never visited the pier.'
        ],
        ambientSoundscape: 'fireplace'
      },
      {
        id: 'ch-lagoon-3',
        storyId: 'story-lagoon-letters',
        chapterNumber: 3,
        title: 'Opening the Timber Windows',
        slug: 'opening-the-timber-windows',
        releaseDate: 'Oct 24, 2026',
        wordCount: 2100,
        readTimeMinutes: 8,
        isFree: true,
        excerpt: 'When the shutters finally swung wide, golden afternoon light flooded every empty shelf.',
        content: [
          'When the shutters finally swung wide, golden afternoon light flooded every empty shelf.',
          'Breeze off the lagoon carried the scent of fresh cedar and rain-washed stone as the first crates of books arrived at the harbor steps.'
        ],
        ambientSoundscape: 'rain'
      }
    ]
  }
];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [];
