// Mixed image / video media manifest for the gallery.
// aspect = width / height of the *source* file, used for cover-fit UV mapping
// so each tile crops nicely no matter its native ratio (grid cells are uniform).

export const galleryItems = [
  { id: 'img-01', type: 'image', src: '/media/images/img-01.jpg', aspect: 900 / 1200, title: 'Drift I' },
  { id: 'img-02', type: 'image', src: '/media/images/img-02.jpg', aspect: 1200 / 900, title: 'Fracture' },
  { id: 'vid-01', type: 'video', src: '/media/videos/vid-01.mp4', aspect: 720 / 960, title: 'Convergence' },
  { id: 'img-03', type: 'image', src: '/media/images/img-03.jpg', aspect: 1, title: 'Rule 30' },
  { id: 'img-04', type: 'image', src: '/media/images/img-04.jpg', aspect: 900 / 1200, title: 'Spectrum' },
  { id: 'img-05', type: 'image', src: '/media/images/img-05.jpg', aspect: 1200 / 900, title: 'Ember' },
  { id: 'vid-02', type: 'video', src: '/media/videos/vid-02.mp4', aspect: 960 / 720, title: 'Mold' },
  { id: 'img-06', type: 'image', src: '/media/images/img-06.jpg', aspect: 1, title: 'Cellular' },
  { id: 'img-07', type: 'image', src: '/media/images/img-07.jpg', aspect: 900 / 1200, title: 'Seahorse' },
  { id: 'img-08', type: 'image', src: '/media/images/img-08.jpg', aspect: 1200 / 900, title: 'Verdant' },
  { id: 'vid-03', type: 'video', src: '/media/videos/vid-03.mp4', aspect: 1, title: 'Bloom' },
  { id: 'img-09', type: 'image', src: '/media/images/img-09.jpg', aspect: 1, title: 'Rule 110' },
  { id: 'img-10', type: 'image', src: '/media/images/img-10.jpg', aspect: 900 / 1200, title: 'Violet' },
  { id: 'img-11', type: 'image', src: '/media/images/img-11.jpg', aspect: 1200 / 900, title: 'Aurora' },
  { id: 'vid-04', type: 'video', src: '/media/videos/vid-04.mp4', aspect: 720 / 960, title: 'Automaton' },
  { id: 'img-12', type: 'image', src: '/media/images/img-12.jpg', aspect: 1, title: 'Deep Zoom' },
  { id: 'img-13', type: 'image', src: '/media/images/img-13.jpg', aspect: 900 / 1200, title: 'Cyan Mold' },
  { id: 'img-14', type: 'image', src: '/media/images/img-14.jpg', aspect: 1200 / 900, title: 'Gold Field' },
  { id: 'vid-05', type: 'video', src: '/media/videos/vid-05.mp4', aspect: 960 / 720, title: 'Descent' },
]
