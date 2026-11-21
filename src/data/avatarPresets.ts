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
    src: '/assets/images/avatars/avatar_bronze_scribe.jpg',
  },
  {
    id: 'moonlit-reader',
    label: 'Moonlit Reader',
    caption: 'Midnight folio & lantern light',
    src: '/assets/images/avatars/avatar_moonlit_reader.jpg',
  },
  {
    id: 'celestial-astrolabe',
    label: 'Celestial Astrolabe',
    caption: 'Navigator of myth & constellations',
    src: '/assets/images/avatars/avatar_celestial_astrolabe.jpg',
  },
  {
    id: 'baobab-lantern',
    label: 'Baobab Lantern',
    caption: 'Keeper of twilight savanna tales',
    src: '/assets/images/avatars/avatar_baobab_lantern.jpg',
  },
  {
    id: 'bronze-medallion',
    label: 'Bronze Medallion',
    caption: 'Ceremonial guild crest',
    src: '/assets/images/avatars/avatar_crimson_mask.jpg',
  },
  {
    id: 'sunlit-chronicler',
    label: 'Sunlit Chronicler',
    caption: 'Curator of morning verse & ink',
    src: '/assets/images/avatars/avatar_sunlit_chronicler.jpg',
  },
];
