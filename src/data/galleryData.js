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
    // Short 5s loop for the grid/project hero; the uploaded full-length cut
    // (media/images/video00.mp4, ~41s) is in the repo if it's needed later
    // (e.g. playing in full once opened) — swap `src` to that when ready.
    src: 'media/images/video00-preview.mp4',
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
    // Short 5s loop for the grid/project hero; the uploaded full-length cut
    // (media/images/video01.mp4, ~12s) is in the repo if it's needed later.
    // Vertical (9:16) — the project page shows it centered with margins
    // instead of full-bleed, see heroLayout.js.
    src: 'media/images/video01-preview.mp4',
    aspect: 720 / 1280,
    title: 'Mirage',
    client: '',
    year: '',
    screenshots: [],
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
