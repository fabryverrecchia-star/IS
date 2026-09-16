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
//
// Videos are temporarily removed (no real footage yet) — add them back here
// once real clips are ready.

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
]

// DEMO ONLY: for any project without its own real `images` yet, fall back
// to its cover repeated 4x so the project page's parallax scroll reveal is
// visible. Once a project lists its own real extra photos (like 'img61'
// above), that list is used as-is — replace the rest the same way and
// delete this fallback.
export const galleryItems = rawItems.map((item) =>
  item.images
    ? item
    : {
        ...item,
        images: [item, item, item, item].map(({ src, aspect }) => ({ src, aspect })),
      }
)
