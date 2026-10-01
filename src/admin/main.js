import './admin.css'
import { galleryItems as savedProjects } from '../data/galleryData.js'
import { journalItems as savedJournal } from '../data/journalData.js'
import { siteSettings as savedSettings } from '../data/siteSettings.js'

// Change this to set your own passcode. This is a purely static site with
// no server, so this can only ever deter a casual visitor from poking at
// the dashboard — anyone who reads the page's source can find it. Treat it
// as a "keep honest people out" lock, not real security.
const ADMIN_CODE = 'isma-admin-2026'

const STORAGE_KEY = 'ismael-admin-draft-v2'

// -----------------------------------------------------------------------
// Gate
// -----------------------------------------------------------------------
const gate = document.getElementById('gate')
const gateForm = document.getElementById('gate-form')
const gateInput = document.getElementById('gate-input')
const gateError = document.getElementById('gate-error')
const dashboard = document.getElementById('dashboard')

function unlock() {
  gate.hidden = true
  dashboard.hidden = false
  sessionStorage.setItem('ismael-admin-unlocked', '1')
  initDashboard()
}

gateForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (gateInput.value === ADMIN_CODE) {
    unlock()
  } else {
    gateError.hidden = false
    gateInput.value = ''
    gateInput.focus()
  }
})

if (sessionStorage.getItem('ismael-admin-unlocked') === '1') {
  unlock()
}

// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------
// Each project/journal item in state carries its data plus a generated
// `_key` (stable list identity for expand/collapse + drag) and its extras
// normalized to `_extras` (mapped back to `images`/`screenshots` on export
// depending on type). A freshly-picked File — not yet an exported path on
// disk — lives directly on the item as `_coverFile`/`_posterFile`, or per
// extra as `_file`, so a thumbnail can preview it immediately via
// URL.createObjectURL. The same File is also registered in `pendingFiles`,
// keyed by the path it's destined for, so the export step can hand it back
// out alongside the data that references it.
let state = null
const pendingFiles = new Map() // relative src path -> File
let expandedKeys = new Set()

function freshKey() {
  return Math.random().toString(36).slice(2, 10)
}

function projectFromSaved(item) {
  return {
    _key: freshKey(),
    id: item.id || '',
    type: item.type || 'image',
    title: item.title || '',
    client: item.client || '',
    year: item.year || '',
    description: item.description || '',
    link: item.link || '',
    loaderPinned: !!item.loaderPinned,
    src: item.src || '',
    aspect: item.aspect || 1,
    fullSrc: item.fullSrc || '',
    poster: item.poster || '',
    _extras: (item.type === 'video' ? item.screenshots : item.images || []).map((e) => ({
      _key: freshKey(),
      src: e.src,
      aspect: e.aspect,
    })),
  }
}

function journalFromSaved(item) {
  return {
    _key: freshKey(),
    title: item.title || '',
    client: item.client || '',
    year: item.year || '',
    category: item.category || '',
    description: item.description || '',
    src: item.src || '',
    aspect: item.aspect || 1,
    _extras: (item.gallery || []).map((e) => ({ _key: freshKey(), src: e.src, aspect: e.aspect })),
  }
}

function freshState() {
  return {
    projects: savedProjects.map(projectFromSaved),
    journal: savedJournal.map(journalFromSaved),
    settings: { ...savedSettings },
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore malformed draft, fall through to a fresh one
  }
  return freshState()
}

// Files can't round-trip through localStorage, so a persisted draft only
// ever restores text fields — a picked-but-not-yet-exported image is lost
// on reload. Acceptable: the common path is pick an image then export
// within the same sitting, and a reload mid-edit is rare.
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// -----------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------
function updateCounts() {
  document.getElementById('dash-counts').textContent = `${state.projects.length} projets · ${state.journal.length} entrées Journal`
}

function initDashboard() {
  state = loadState()

  document.querySelectorAll('.dash-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach((t) => t.classList.remove('is-active'))
      document.querySelectorAll('.dash-panel').forEach((p) => p.classList.remove('is-active'))
      tab.classList.add('is-active')
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('is-active')
    })
  })

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Repartir des données actuellement publiées sur le site ? Tes modifications non enregistrées seront perdues.')) return
    state = freshState()
    pendingFiles.clear()
    expandedKeys.clear()
    persist()
    renderProjects()
    renderJournal()
    renderSettings()
  })

  document.getElementById('add-project-btn').addEventListener('click', () => {
    const project = projectFromSaved({ type: 'image' })
    state.projects.push(project)
    expandedKeys.add(project._key)
    persist()
    renderProjects()
  })

  document.getElementById('add-journal-btn').addEventListener('click', () => {
    const entry = journalFromSaved({})
    state.journal.push(entry)
    expandedKeys.add(entry._key)
    persist()
    renderJournal()
  })

  document.getElementById('settings-form').addEventListener('input', (e) => {
    state.settings[e.target.name] = e.target.value
    persist()
  })

  document.getElementById('export-btn').addEventListener('click', exportAll)
  document.getElementById('export-close-btn').addEventListener('click', () => {
    document.getElementById('export-modal').hidden = true
  })

  renderProjects()
  renderJournal()
  renderSettings()
}

function renderSettings() {
  const form = document.getElementById('settings-form')
  Object.entries(state.settings).forEach(([key, value]) => {
    const field = form.elements.namedItem(key)
    if (field) field.value = value
  })
}

// -----------------------------------------------------------------------
// Image file handling
// -----------------------------------------------------------------------
function suggestedPath(file) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-]+/g, '-')
  return `media/images/${safeName}`
}

function readImageAspect(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve(img.naturalWidth / img.naturalHeight)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => resolve(1)
    img.src = url
  })
}

// Resolves what a thumbnail should show right now: a just-picked file (not
// yet an exported path on disk) always wins over whatever path string is
// already stored, since that's the fresher intent.
function previewUrlFor(file, path) {
  if (file) return URL.createObjectURL(file)
  // admin.html sits next to index.html at the site root, same as the real
  // gallery — so an existing item's relative path resolves the same way
  // here as it does there, no adjustment needed.
  if (path) return path
  return null
}

function setThumb(imgEl, emptyEl, url) {
  if (url) {
    imgEl.src = url
    imgEl.hidden = false
    emptyEl.hidden = true
  } else {
    imgEl.hidden = true
    emptyEl.hidden = false
  }
}

// -----------------------------------------------------------------------
// Shared card behaviour (expand/collapse, drag reorder, pin, remove)
// -----------------------------------------------------------------------
function bindCardChrome(card, item, index, list, renderFn) {
  const head = card.querySelector('[data-action="toggle-expand"]')
  const body = card.querySelector('[data-role="card-body"]')

  const isExpanded = expandedKeys.has(item._key)
  card.classList.toggle('is-expanded', isExpanded)
  body.hidden = !isExpanded

  head.addEventListener('click', () => {
    const expanded = card.classList.toggle('is-expanded')
    body.hidden = !expanded
    if (expanded) expandedKeys.add(item._key)
    else expandedKeys.delete(item._key)
  })

  card.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
    e.stopPropagation()
    if (!confirm(`Supprimer « ${item.title || 'cet élément'} » ?`)) return
    list.splice(index, 1)
    persist()
    renderFn()
  })

  // Drag reorder: only a drag that starts on the handle actually moves the
  // card — without this check, `draggable="true"` on the whole article
  // would turn every click-and-hold (selecting text, pressing a button)
  // into an accidental drag.
  card.addEventListener('dragstart', (e) => {
    if (!e.target.closest('[data-role="drag-handle"]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    requestAnimationFrame(() => card.classList.add('is-dragging'))
  })
  card.addEventListener('dragend', () => card.classList.remove('is-dragging'))
  card.addEventListener('dragover', (e) => {
    e.preventDefault()
    card.classList.add('is-drag-over')
  })
  card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'))
  card.addEventListener('drop', (e) => {
    e.preventDefault()
    card.classList.remove('is-drag-over')
    const fromIndex = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(fromIndex) || fromIndex === index) return
    const [moved] = list.splice(fromIndex, 1)
    // Removing fromIndex shifts everything after it left by one, so the
    // drop target's own index needs the same adjustment when it came after.
    const targetIndex = fromIndex < index ? index - 1 : index
    list.splice(targetIndex, 0, moved)
    persist()
    renderFn()
  })
}

// -----------------------------------------------------------------------
// Extras grid (shared between projects and journal entries)
// -----------------------------------------------------------------------
function renderExtras(card, item) {
  const grid = card.querySelector('[data-role="extras-list"]')
  const tileTemplate = document.getElementById('extra-tile-template')
  grid.innerHTML = ''

  item._extras.forEach((extra, i) => {
    const node = tileTemplate.content.cloneNode(true)
    const tile = node.querySelector('[data-role="extra-tile"]')
    const img = tile.querySelector('[data-role="extra-img"]')
    const empty = tile.querySelector('[data-role="extra-empty"]')
    const fileInput = tile.querySelector('[data-field="extra-file"]')

    setThumb(img, empty, previewUrlFor(extra._file, extra.src))

    tile.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="remove-extra"]')) return
      fileInput.click()
    })
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const path = suggestedPath(file)
      extra.src = path
      extra._file = file
      pendingFiles.set(path, file)
      setThumb(img, empty, previewUrlFor(file, path))
      extra.aspect = await readImageAspect(file)
      persist()
    })
    tile.querySelector('[data-action="remove-extra"]').addEventListener('click', (e) => {
      e.stopPropagation()
      item._extras.splice(i, 1)
      persist()
      renderExtras(card, item)
    })

    grid.appendChild(node)
  })

  // Trailing "+" tile — clicking it opens a file picker directly, no
  // intermediate "add a row" step.
  const addTile = document.createElement('div')
  addTile.className = 'extra-tile is-add-tile'
  const addEmpty = document.createElement('span')
  addEmpty.className = 'extra-empty'
  addEmpty.textContent = '+'
  addTile.appendChild(addEmpty)
  const addInput = document.createElement('input')
  addInput.type = 'file'
  addInput.accept = 'image/*'
  addInput.hidden = true
  addTile.appendChild(addInput)
  addTile.addEventListener('click', () => addInput.click())
  addInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const path = suggestedPath(file)
    const aspect = await readImageAspect(file)
    pendingFiles.set(path, file)
    item._extras.push({ _key: freshKey(), src: path, aspect, _file: file })
    persist()
    renderExtras(card, item)
  })
  grid.appendChild(addTile)
}

// -----------------------------------------------------------------------
// Projects panel
// -----------------------------------------------------------------------
function renderProjects() {
  updateCounts()
  const list = document.getElementById('projects-list')
  list.innerHTML = ''
  const template = document.getElementById('project-card-template')

  state.projects.forEach((project, index) => {
    const node = template.content.cloneNode(true)
    const card = node.querySelector('[data-role="project-card"]')
    bindProjectCard(card, project, index)
    list.appendChild(node)
  })
}

function bindProjectCard(card, project, index) {
  const field = (name) => card.querySelector(`[data-field="${name}"]`)
  const titlePreview = field('title-preview')
  const subtitlePreview = field('subtitle-preview')
  const thumbImg = card.querySelector('[data-role="thumb-img"]')
  const thumbEmpty = card.querySelector('[data-role="thumb-empty"]')

  const refreshHeader = () => {
    titlePreview.textContent = project.title || '(sans titre)'
    subtitlePreview.textContent = [project.client, project.year].filter(Boolean).join(' · ')
    const coverUrl = previewUrlFor(project._coverFile || project._posterFile, project.type === 'video' ? project.poster : project.src)
    setThumb(thumbImg, thumbEmpty, coverUrl)
  }
  refreshHeader()

  field('title').value = project.title
  field('client').value = project.client
  field('year').value = project.year
  field('link').value = project.link
  field('description').value = project.description
  field('videoSrc').value = project.type === 'video' ? project.src : ''
  field('fullSrc').value = project.fullSrc

  const pinBtn = card.querySelector('[data-action="toggle-pin"]')
  pinBtn.classList.toggle('is-active', project.loaderPinned)
  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    project.loaderPinned = !project.loaderPinned
    pinBtn.classList.toggle('is-active', project.loaderPinned)
    persist()
  })

  const imageFields = card.querySelector('[data-role="image-fields"]')
  const videoFields = card.querySelector('[data-role="video-fields"]')
  const typePills = card.querySelectorAll('[data-type]')
  function syncType() {
    const isVideo = project.type === 'video'
    imageFields.hidden = isVideo
    videoFields.hidden = !isVideo
    typePills.forEach((pill) => pill.classList.toggle('is-active', pill.dataset.type === project.type))
  }
  syncType()
  typePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      project.type = pill.dataset.type
      syncType()
      refreshHeader()
      persist()
    })
  })

  ;['title', 'client', 'year', 'link', 'description'].forEach((key) => {
    field(key).addEventListener('input', (e) => {
      project[key] = e.target.value
      if (key === 'title' || key === 'client' || key === 'year') refreshHeader()
      persist()
    })
  })
  field('videoSrc').addEventListener('input', (e) => {
    project.src = e.target.value
    persist()
  })
  field('fullSrc').addEventListener('input', (e) => {
    project.fullSrc = e.target.value
    persist()
  })

  // Cover picker (image projects)
  const coverImg = card.querySelector('[data-role="cover-img"]')
  const coverEmpty = card.querySelector('[data-role="cover-empty"]')
  setThumb(coverImg, coverEmpty, previewUrlFor(project._coverFile, project.src))
  card.querySelector('[data-action="pick-cover"]').addEventListener('click', () => field('src-file').click())
  field('src-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const path = suggestedPath(file)
    project.src = path
    project._coverFile = file
    pendingFiles.set(path, file)
    setThumb(coverImg, coverEmpty, previewUrlFor(file, path))
    refreshHeader()
    project.aspect = await readImageAspect(file)
    persist()
  })

  // Poster picker (video projects) — the visual thumbnail for a video
  const posterImg = card.querySelector('[data-role="poster-img"]')
  const posterEmpty = card.querySelector('[data-role="poster-empty"]')
  setThumb(posterImg, posterEmpty, previewUrlFor(project._posterFile, project.poster))
  card.querySelector('[data-action="pick-poster"]').addEventListener('click', () => field('poster-file').click())
  field('poster-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const path = suggestedPath(file)
    project.poster = path
    project._posterFile = file
    pendingFiles.set(path, file)
    setThumb(posterImg, posterEmpty, previewUrlFor(file, path))
    refreshHeader()
    persist()
  })

  bindCardChrome(card, project, index, state.projects, renderProjects)
  renderExtras(card, project)
}

// -----------------------------------------------------------------------
// Journal panel
// -----------------------------------------------------------------------
function renderJournal() {
  updateCounts()
  const list = document.getElementById('journal-list')
  list.innerHTML = ''
  const template = document.getElementById('journal-card-template')

  state.journal.forEach((entry, index) => {
    const node = template.content.cloneNode(true)
    const card = node.querySelector('[data-role="journal-card"]')
    bindJournalCard(card, entry, index)
    list.appendChild(node)
  })
}

function bindJournalCard(card, entry, index) {
  const field = (name) => card.querySelector(`[data-field="${name}"]`)
  const titlePreview = field('title-preview')
  const subtitlePreview = field('subtitle-preview')
  const thumbImg = card.querySelector('[data-role="thumb-img"]')
  const thumbEmpty = card.querySelector('[data-role="thumb-empty"]')

  const refreshHeader = () => {
    titlePreview.textContent = entry.title || '(sans titre)'
    subtitlePreview.textContent = [entry.client, entry.category].filter(Boolean).join(' · ')
    setThumb(thumbImg, thumbEmpty, previewUrlFor(entry._coverFile, entry.src))
  }
  refreshHeader()

  ;['title', 'client', 'year', 'category', 'description'].forEach((key) => {
    field(key).value = entry[key]
    field(key).addEventListener('input', (e) => {
      entry[key] = e.target.value
      if (key === 'title' || key === 'client' || key === 'category') refreshHeader()
      persist()
    })
  })

  const coverImg = card.querySelector('[data-role="cover-img"]')
  const coverEmpty = card.querySelector('[data-role="cover-empty"]')
  setThumb(coverImg, coverEmpty, previewUrlFor(entry._coverFile, entry.src))
  card.querySelector('[data-action="pick-cover"]').addEventListener('click', () => field('src-file').click())
  field('src-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const path = suggestedPath(file)
    entry.src = path
    entry._coverFile = file
    pendingFiles.set(path, file)
    setThumb(coverImg, coverEmpty, previewUrlFor(file, path))
    refreshHeader()
    entry.aspect = await readImageAspect(file)
    persist()
  })

  bindCardChrome(card, entry, index, state.journal, renderJournal)
  renderExtras(card, entry)
}

// -----------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------
function jsStringLiteral(value) {
  return JSON.stringify(value ?? '')
}

function formatAspect(aspect) {
  return Number(aspect.toFixed(4))
}

function serializeExtrasBlock(extras) {
  if (!extras.length) return '[]'
  const rows = extras
    .map((e) => `      { src: ${jsStringLiteral(e.src)}, aspect: ${formatAspect(e.aspect)} },`)
    .join('\n')
  return `[\n${rows}\n    ]`
}

function serializeProjects(projects) {
  const entries = projects.map((p) => {
    const lines = []
    lines.push(`  {`)
    lines.push(`    id: ${jsStringLiteral(p.id || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))},`)
    lines.push(`    type: ${jsStringLiteral(p.type)},`)
    lines.push(`    src: ${jsStringLiteral(p.src)},`)
    if (p.type === 'video') {
      lines.push(`    fullSrc: ${jsStringLiteral(p.fullSrc)},`)
      lines.push(`    poster: ${jsStringLiteral(p.poster)},`)
    }
    lines.push(`    aspect: ${formatAspect(p.aspect)},`)
    lines.push(`    title: ${jsStringLiteral(p.title)},`)
    lines.push(`    client: ${jsStringLiteral(p.client)},`)
    lines.push(`    year: ${jsStringLiteral(p.year)},`)
    if (p.loaderPinned) lines.push(`    loaderPinned: true,`)
    if (p.description) lines.push(`    description: ${jsStringLiteral(p.description)},`)
    if (p.link) lines.push(`    link: ${jsStringLiteral(p.link)},`)
    if (p.type === 'video') {
      lines.push(`    screenshots: ${serializeExtrasBlock(p._extras)},`)
    } else if (p._extras.length) {
      lines.push(`    images: ${serializeExtrasBlock(p._extras)},`)
    }
    lines.push(`  },`)
    return lines.join('\n')
  })
  return `[\n${entries.join('\n')}\n]`
}

function serializeJournal(entries) {
  const rows = entries.map((e) => {
    const lines = []
    lines.push(`  {`)
    lines.push(`    src: ${jsStringLiteral(e.src)},`)
    lines.push(`    title: ${jsStringLiteral(e.title)},`)
    lines.push(`    client: ${jsStringLiteral(e.client)},`)
    lines.push(`    year: ${jsStringLiteral(e.year)},`)
    lines.push(`    category: ${jsStringLiteral(e.category)},`)
    lines.push(`    description: ${jsStringLiteral(e.description)},`)
    lines.push(`    gallery: ${serializeExtrasBlock(e._extras)},`)
    lines.push(`  },`)
    return lines.join('\n')
  })
  return `[\n${rows.join('\n')}\n]`
}

function buildGalleryDataFile() {
  return `// Generated by the admin dashboard (admin.html) — edits made there and
// exported overwrite this file. Hand edits are fine too; the admin just
// re-reads whatever shape is here (see src/admin/main.js).
//
// aspect = width / height of the source file (cover-fit UV mapping, so each
// tile crops nicely no matter its native ratio).
// - Image projects can list extra \`images\` (each { src, aspect }).
// - Video projects can list \`screenshots\` (each { src, aspect }).
// - \`loaderPinned: true\` includes a project's cover in the preloader.

export const galleryItems = ${serializeProjects(state.projects)}
`
}

function buildJournalDataFile() {
  return `// Generated by the admin dashboard (admin.html) — see galleryData.js's
// header for the shared conventions (aspect, etc). \`gallery\` is the
// click-through detail panel's own horizontally-scrollable showcase.

export const journalItems = ${serializeJournal(state.journal)}
`
}

function buildSiteSettingsFile() {
  const s = state.settings
  return `// Generated by the admin dashboard (admin.html).
export const siteSettings = {
  subtitle: ${jsStringLiteral(s.subtitle)},
  contactEmail: ${jsStringLiteral(s.contactEmail)},
  instagramUrl: ${jsStringLiteral(s.instagramUrl)},
  arenaUrl: ${jsStringLiteral(s.arenaUrl)},
  footerCopyright: ${jsStringLiteral(s.footerCopyright)},
  footerEdition: ${jsStringLiteral(s.footerEdition)},
}
`
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBinaryFile(filename, file) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Each file downloads from its own explicit click rather than all being
// triggered at once from the "Enregistrer" button — Chrome (and others)
// treat several programmatic downloads fired back-to-back as a flood and
// silently block everything after the first one. A genuine click per file
// sidesteps that entirely, and doubles as a way to re-grab one file without
// redoing the others.
function addExportRow(parent, label, onClick) {
  const row = document.createElement('li')
  row.className = 'export-row'
  const span = document.createElement('span')
  span.innerHTML = label
  const link = document.createElement('a')
  link.href = '#'
  link.textContent = 'Télécharger'
  link.addEventListener('click', (e) => {
    e.preventDefault()
    onClick()
    link.textContent = 'Téléchargé ✓'
    link.classList.add('is-done')
  })
  row.appendChild(span)
  row.appendChild(link)
  parent.appendChild(row)
}

function exportAll() {
  const steps = document.getElementById('export-steps')
  steps.innerHTML = ''

  addExportRow(steps, 'Données des projets <code>galleryData.js</code>', () => downloadTextFile('galleryData.js', buildGalleryDataFile()))
  addExportRow(steps, 'Données du Journal <code>journalData.js</code>', () => downloadTextFile('journalData.js', buildJournalDataFile()))
  addExportRow(steps, 'Réglages <code>siteSettings.js</code>', () => downloadTextFile('siteSettings.js', buildSiteSettingsFile()))

  pendingFiles.forEach((file, path) => {
    const filename = path.split('/').pop()
    addExportRow(steps, `Photo <code>${filename}</code>`, () => downloadBinaryFile(filename, file))
  })

  document.getElementById('export-modal').hidden = false
}
