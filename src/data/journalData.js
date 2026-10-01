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
//
// Edit this file by hand, or via the admin dashboard (admin.html), which
// edits/exports this same shape.
export const journalItems = [
  {
    // Landscape studio shot (full figure, already near the card's own 4:3
    // ratio) rather than a portrait one — the card's cover-fit crop centers
    // vertically, which on a portrait source cuts off the face/head.
    src: 'media/images/castelbajac-mattel00.jpg',
    title: 'Barbie & Ken × Jean-Charles de Castelbajac',
    client: 'Mattel Creations',
    year: '2026',
    category: 'Collaboration',
    description:
      'Rencontre avec Jean-Charles de Castelbajac dans son atelier, à l’occasion de sa collaboration avec Mattel Creations — le manteau en peluche de 1987 réinterprété pour Barbie et Ken.',
    gallery: [
      { src: 'media/images/castelbajac-mattel00.jpg', aspect: 1344 / 1038 },
      { src: 'media/images/castelbajac-mattel01.jpg', aspect: 1500 / 2000 },
      { src: 'media/images/castelbajac-mattel04.jpg', aspect: 1500 / 2000 },
    ],
  },
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
