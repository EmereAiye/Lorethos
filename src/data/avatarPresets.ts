import avatarBronzeScribe from '../assets/images/avatar_bronze_scribe_1795168939968.jpg';
import avatarMoonlitReader from '../assets/images/avatar_moonlit_reader_1795168940080.jpg';
import avatarCelestialAstrolabe from '../assets/images/avatar_celestial_astrolabe_1795168940345.jpg';
import avatarBaobabLantern from '../assets/images/avatar_baobab_lantern_1795168940763.jpg';
import avatarBronzeMedallion from '../assets/images/avatar_crimson_mask_1795168940497.jpg';
import avatarSunlitChronicler from '../assets/images/avatar_sunlit_chronicler_1795168940731.jpg';

export interface AvatarPreset {
  id: string;
  label: string;
  caption: string;
  src: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'bronze-scribe',
    label: 'Bronze Scribe',
    caption: 'Scholar of royal brass & parchment',
    src: avatarBronzeScribe,
  },
  {
    id: 'moonlit-reader',
    label: 'Moonlit Reader',
    caption: 'Midnight folio & lantern light',
    src: avatarMoonlitReader,
  },
  {
    id: 'celestial-astrolabe',
    label: 'Celestial Astrolabe',
    caption: 'Navigator of myth & constellations',
    src: avatarCelestialAstrolabe,
  },
  {
    id: 'baobab-lantern',
    label: 'Baobab Lantern',
    caption: 'Keeper of twilight savanna tales',
    src: avatarBaobabLantern,
  },
  {
    id: 'bronze-medallion',
    label: 'Bronze Medallion',
    caption: 'Ceremonial guild crest',
    src: avatarBronzeMedallion,
  },
  {
    id: 'sunlit-chronicler',
    label: 'Sunlit Chronicler',
    caption: 'Curator of morning verse & ink',
    src: avatarSunlitChronicler,
  },
];
