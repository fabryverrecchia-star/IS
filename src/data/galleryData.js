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

export const galleryItems = [
  {
    id: 'img3',
    type: 'image',
    src: 'media/images/img3.jpg',
    aspect: 1080 / 1349,
    title: 'Bazaar Arabia',
    client: 'Harper’s Bazaar Arabia',
    year: '',
    images: [],
  },
  {
    id: 'img15',
    type: 'image',
    src: 'media/images/img15.jpg',
    aspect: 1080 / 1440,
    title: 'Faithful',
    client: '',
    year: '',
    images: [],
  },
  {
    id: 'img27',
    type: 'image',
    src: 'media/images/img27.jpg',
    aspect: 1920 / 2560,
    title: 'Bloom',
    client: '',
    year: '',
    images: [],
  },
  {
    id: 'img37',
    type: 'image',
    src: 'media/images/img37.jpg',
    aspect: 1707 / 2560,
    title: 'Suspension',
    client: '',
    year: '',
    images: [],
  },
  {
    id: 'img49',
    type: 'image',
    src: 'media/images/img49.jpg',
    aspect: 1024 / 1280,
    title: 'Khamsa',
    client: 'Khamsa',
    year: '',
    images: [],
  },
  {
    id: 'img61',
    type: 'image',
    src: 'media/images/img61.jpg',
    aspect: 1708 / 2560,
    title: 'Utility',
    client: '',
    year: '',
    images: [],
  },
]
