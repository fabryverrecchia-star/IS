// Mixed image / video media manifest for the gallery.
// aspect = width / height of the *source* file, used for cover-fit UV mapping
// so each tile crops nicely no matter its native ratio (grid cells are uniform).
//
// Videos are temporarily removed (placeholders only, no real footage yet) —
// add them back here once real clips are ready.

export const galleryItems = [
  { id: 'img-01', type: 'image', src: 'media/images/img-01.jpg', aspect: 900 / 1200, title: 'Drift I' },
  { id: 'img-02', type: 'image', src: 'media/images/img-02.jpg', aspect: 1200 / 900, title: 'Fracture' },
  { id: 'img-03', type: 'image', src: 'media/images/img-03.jpg', aspect: 1, title: 'Rule 30' },
  { id: 'img-04', type: 'image', src: 'media/images/img-04.jpg', aspect: 900 / 1200, title: 'Spectrum' },
  { id: 'img-05', type: 'image', src: 'media/images/img-05.jpg', aspect: 1200 / 900, title: 'Ember' },
  { id: 'img-06', type: 'image', src: 'media/images/img-06.jpg', aspect: 1, title: 'Cellular' },
  { id: 'img-07', type: 'image', src: 'media/images/img-07.jpg', aspect: 900 / 1200, title: 'Seahorse' },
  { id: 'img-08', type: 'image', src: 'media/images/img-08.jpg', aspect: 1200 / 900, title: 'Verdant' },
  { id: 'img-09', type: 'image', src: 'media/images/img-09.jpg', aspect: 1, title: 'Rule 110' },
  { id: 'img-10', type: 'image', src: 'media/images/img-10.jpg', aspect: 900 / 1200, title: 'Violet' },
  { id: 'img-11', type: 'image', src: 'media/images/img-11.jpg', aspect: 1200 / 900, title: 'Aurora' },
  { id: 'img-12', type: 'image', src: 'media/images/img-12.jpg', aspect: 1, title: 'Deep Zoom' },
  { id: 'img-13', type: 'image', src: 'media/images/img-13.jpg', aspect: 900 / 1200, title: 'Cyan Mold' },
  { id: 'img-14', type: 'image', src: 'media/images/img-14.jpg', aspect: 1200 / 900, title: 'Gold Field' },
]
