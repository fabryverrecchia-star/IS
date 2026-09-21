// Mixed image / video media manifest for the gallery.
// aspect = width / height of the *source* file, used for cover-fit UV mapping
// so each tile crops nicely no matter its native ratio (grid cells are uniform).
//
// Each entry is a "project": the cover (src/aspect) drives the grid tile and
// the entrance animation; client/year are optional and shown top-right on
// the project page once opened.
//
// - Image projects can list extra `images` (each { src, aspect }) that
//   reveal further down the project page with a parallax scroll.
// - Video projects can list `screenshots` (each { src, aspect }) shown
//   below the playing video.

const rawItems = [
  {
    id: 'img3',
    type: 'image',
    src: 'media/images/img3.jpg',
    aspect: 1080 / 1349,
    title: 'Bazaar Arabia',
    client: 'Harper’s Bazaar Arabia',
    year: '',
  },
  {
    id: 'img15',
    type: 'image',
    src: 'media/images/img15.jpg',
    aspect: 1080 / 1440,
    title: 'Faithful',
    client: '',
    year: '',
  },
  {
    id: 'img27',
    type: 'image',
    src: 'media/images/img27.jpg',
    aspect: 1920 / 2560,
    title: 'Bloom',
    client: '',
    year: '',
  },
  {
    id: 'img37',
    type: 'image',
    src: 'media/images/img37.jpg',
    aspect: 1707 / 2560,
    title: 'Suspension',
    client: '',
    year: '',
  },
  {
    id: 'video00',
    type: 'video',
    // Short muted 5s loop for the grid tile teaser; the project page plays
    // the real uploaded cut (with sound) instead, via fullSrc.
    src: 'media/images/video00-preview.mp4',
    fullSrc: 'media/images/video00.mp4',
    // Still frame used where a plain image is needed (e.g. the 3D carousel
    // view's card faces) — a video can't be a CSS background-image.
    poster: 'media/images/video00-poster.jpg',
    aspect: 1280 / 674,
    title: 'Petals',
    client: '',
    year: '',
    screenshots: [],
  },
  {
    id: 'img49',
    type: 'image',
    src: 'media/images/img49.jpg',
    aspect: 1024 / 1280,
    title: 'Khamsa',
    client: 'Khamsa',
    year: '',
  },
  {
    id: 'img61',
    type: 'image',
    src: 'media/images/img61.jpg',
    aspect: 1708 / 2560,
    title: 'Utility',
    client: '',
    year: '',
    images: [
      { src: 'media/images/img62.jpg', aspect: 1708 / 2560 },
      { src: 'media/images/img63.jpg', aspect: 1708 / 2560 },
      { src: 'media/images/img64.jpg', aspect: 2048 / 2560 },
    ],
  },
  {
    id: 'project00',
    type: 'image',
    src: 'media/images/project00.jpg',
    aspect: 1440 / 1800,
    title: 'A Part — Noomi Rapace',
    client: 'A Part Magazine',
    year: '',
  },
  {
    id: 'project01',
    type: 'image',
    src: 'media/images/project01.jpg',
    aspect: 1440 / 1920,
    title: 'Vanity Teen — Ali Latif',
    client: 'Vanity Teen',
    year: '',
  },
  {
    id: 'video01',
    type: 'video',
    // Short muted 5s loop for the grid tile teaser; the project page plays
    // the real uploaded cut (with sound) instead, via fullSrc.
    // Vertical (9:16) — the project page shows it centered with margins
    // instead of full-bleed, see heroLayout.js.
    src: 'media/images/video01-preview.mp4',
    fullSrc: 'media/images/video01.mp4',
    poster: 'media/images/video01-poster.jpg',
    aspect: 720 / 1280,
    title: 'Mirage',
    client: '',
    year: '',
    screenshots: [],
  },
  {
    id: 'project07',
    type: 'image',
    src: 'media/images/project07.jpg',
    aspect: 1440 / 1920,
    title: '3 Paradis — Jean-Charles de Castelbajac',
    client: 'Weston',
    year: '',
    images: [
      { src: 'media/images/project08.jpg', aspect: 1080 / 1440 },
      { src: 'media/images/project09.jpg', aspect: 1440 / 1920 },
    ],
  },
  {
    id: 'project10',
    type: 'image',
    src: 'media/images/project10.jpg',
    aspect: 1170 / 1463,
    title: 'The Weight of Character — Noomi Rapace',
    client: 'LE MILE',
    year: '',
    images: [
      { src: 'media/images/project10A.jpg', aspect: 1170 / 1465 },
      { src: 'media/images/project11.jpg', aspect: 1170 / 1463 },
    ],
  },
]

// DEMO ONLY: for any *image* project without its own real `images` yet,
// fall back to its cover repeated 4x so the project page's parallax scroll
// reveal is visible. Once a project lists its own real extra photos (like
// 'img61' above), that list is used as-is — replace the rest the same way
// and delete this fallback.
export const galleryItems = rawItems.map((item) =>
  item.images || item.type !== 'image'
    ? item
    : {
        ...item,
        images: [item, item, item, item].map(({ src, aspect }) => ({ src, aspect })),
      }
)

// DEMO ONLY: the "Journal" horizontal strip below the main gallery (see
// JournalView.js) — reuses existing photos already on disk (mostly each
// project's own `images` extras, not otherwise shown as a cover) so the
// section has real, distinct content without needing new assets. Skips
// project10A/project11 despite being unused extras — both have a magazine
// masthead baked into the source frame that crops awkwardly into a 4:3 box.
// client/year/category/description are classic-project-page placeholder
// info for the click-through detail panel (see JournalView.openDetail);
// `gallery` is that panel's own horizontally-scrollable showcase — each
// entry's own cover plus a couple more images (deliberately mixed aspect
// ratios, borrowed from elsewhere since this is a demo) so there's real
// "scroll to see the rest" content, sized by their own real proportions,
// not cropped like the card itself. Swap all of this for real news/update
// entries once there's something to announce.
export const journalItems = [
  {
    src: 'media/images/img62.jpg',
    title: 'Nouveau shooting — Studio',
    client: 'Self-initiated',
    year: '2026',
    category: 'Photographie',
    description:
      'Une série studio autour de la matière et de la lumière dure, pensée comme un carnet de recherche entre deux commandes éditoriales.',
    gallery: [
      { src: 'media/images/img62.jpg', aspect: 1708 / 2560 },
      { src: 'media/images/img49.jpg', aspect: 1024 / 1280 },
      { src: 'media/images/video00-poster.jpg', aspect: 1280 / 674 },
    ],
  },
  {
    src: 'media/images/img63.jpg',
    title: 'Backstage',
    client: 'Harper’s Bazaar Arabia',
    year: '2026',
    category: 'Behind the scenes',
    description:
      'Coulisses du tournage Bazaar Arabia — mise en lumière, essais silhouette et polaroids avant la prise finale.',
    gallery: [
      { src: 'media/images/img63.jpg', aspect: 1708 / 2560 },
      { src: 'media/images/project00.jpg', aspect: 1440 / 1800 },
      { src: 'media/images/img27.jpg', aspect: 1920 / 2560 },
    ],
  },
  {
    src: 'media/images/img64.jpg',
    title: 'Prochain numéro',
    client: 'Vanity Teen',
    year: '2026',
    category: 'À paraître',
    description:
      'Un aperçu de la prochaine collaboration avec Vanity Teen, entre portrait et mode, à paraître dans le prochain numéro.',
    gallery: [
      { src: 'media/images/img64.jpg', aspect: 2048 / 2560 },
      { src: 'media/images/img61.jpg', aspect: 1708 / 2560 },
      { src: 'media/images/video01-poster.jpg', aspect: 720 / 1280 },
    ],
  },
  {
    src: 'media/images/project08.jpg',
    title: 'Direction artistique',
    client: 'Weston',
    year: '2026',
    category: 'Direction artistique',
    description:
      'Direction artistique complète d’une campagne Weston — casting, décor et post-production, en collaboration avec le studio.',
    gallery: [
      { src: 'media/images/project08.jpg', aspect: 1080 / 1440 },
      { src: 'media/images/img3.jpg', aspect: 1080 / 1349 },
      { src: 'media/images/project01.jpg', aspect: 1440 / 1920 },
    ],
  },
  {
    src: 'media/images/project09.jpg',
    title: 'En tournage',
    client: 'Weston',
    year: '2026',
    category: 'Film',
    description:
      'Premières images du tournage vidéo qui accompagne la campagne Weston, tourné en parallèle de la série photo.',
    gallery: [
      { src: 'media/images/project09.jpg', aspect: 1440 / 1920 },
      { src: 'media/images/project07.jpg', aspect: 1440 / 1920 },
      { src: 'media/images/video00-poster.jpg', aspect: 1280 / 674 },
    ],
  },
  {
    src: 'media/images/img37.jpg',
    title: 'Nouvelle série',
    client: 'Self-initiated',
    year: '2026',
    category: 'Photographie',
    description:
      'Nouvelle série personnelle explorant la suspension et le mouvement — un prolongement naturel du travail éditorial en cours.',
    gallery: [
      { src: 'media/images/img37.jpg', aspect: 1707 / 2560 },
      { src: 'media/images/project10.jpg', aspect: 1170 / 1463 },
      { src: 'media/images/video01-poster.jpg', aspect: 720 / 1280 },
    ],
  },
]
