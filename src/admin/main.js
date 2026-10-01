import './admin.css'
import { galleryItems as savedProjects } from '../data/galleryData.js'
import { journalItems as savedJournal } from '../data/journalData.js'
import { siteSettings as savedSettings } from '../data/siteSettings.js'

// Change this to set your own passcode. This is a purely static site with
// no server, so this can only ever deter a casual visitor from poking at
// the dashboard — anyone who reads the page's source can find it. Treat it
// as a "keep honest people out" lock, not real security.
const ADMIN_CODE = 'isma-admin-2026'

const STORAGE_KEY = 'ismael-admin-draft-v1'

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
// `_key` (stable React-less list identity) and its extras list normalized
// to `_extras` (mapped back to `images`/`screenshots` on export depending
// on type). Newly-picked files live in `pendingFiles`, keyed by the `src`
// path they're destined for, so export can hand them back out alongside
// the data that references them.
let state = null
const pendingFiles = new Map() // relative src path -> File

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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// -----------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------
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
    if (!confirm('Repartir des données actuellement publiées sur le site ? Tes modifications non exportées seront perdues.')) return
    state = freshState()
    pendingFiles.clear()
    persist()
    renderProjects()
    renderJournal()
    renderSettings()
  })

  document.getElementById('add-project-btn').addEventListener('click', () => {
    state.projects.push(projectFromSaved({ type: 'image' }))
    persist()
    renderProjects()
  })

  document.getElementById('add-journal-btn').addEventListener('click', () => {
    state.journal.push(journalFromSaved({}))
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
// Image file handling — reads a picked file's natural size to compute
// `aspect` automatically, and queues the File for the export step.
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

async function handleFilePick(file, srcInput, onAspect) {
  const path = srcInput.value.trim() || suggestedPath(file)
  srcInput.value = path
  pendingFiles.set(path, file)
  if (onAspect) onAspect(await readImageAspect(file))
}

// -----------------------------------------------------------------------
// Projects panel
// -----------------------------------------------------------------------
function renderProjects() {
  const list = document.getElementById('projects-list')
  list.innerHTML = ''
  const template = document.getElementById('project-card-template')

  state.projects.forEach((project, index) => {
    const node = template.content.cloneNode(true)
    const card = node.querySelector('[data-role="project-card"]')
    card.dataset.key = project._key
    bindProjectCard(card, project, index)
    list.appendChild(node)
  })
}

function bindProjectCard(card, project, index) {
  const field = (name) => card.querySelector(`[data-field="${name}"]`)
  const titlePreview = field('title-preview')

  const setPreview = () => {
    titlePreview.textContent = project.title || '(sans titre)'
  }
  setPreview()

  field('type').value = project.type
  field('title').value = project.title
  field('client').value = project.client
  field('year').value = project.year
  field('link').value = project.link
  field('description').value = project.description
  field('loaderPinned').checked = project.loaderPinned
  field('src').value = project.src
  field('videoSrc').value = project.type === 'video' ? project.src : ''
  field('fullSrc').value = project.fullSrc
  field('poster').value = project.poster

  const imageFields = card.querySelector('[data-role="image-fields"]')
  const videoFields = card.querySelector('[data-role="video-fields"]')
  function syncTypeVisibility() {
    const isVideo = project.type === 'video'
    imageFields.hidden = isVideo
    videoFields.hidden = !isVideo
  }
  syncTypeVisibility()

  field('type').addEventListener('change', (e) => {
    project.type = e.target.value
    syncTypeVisibility()
    persist()
  })

  ;['title', 'client', 'year', 'link', 'description'].forEach((key) => {
    field(key).addEventListener('input', (e) => {
      project[key] = e.target.value
      if (key === 'title') setPreview()
      persist()
    })
  })

  field('loaderPinned').addEventListener('change', (e) => {
    project.loaderPinned = e.target.checked
    persist()
  })

  field('src').addEventListener('input', (e) => {
    project.src = e.target.value
    persist()
  })
  field('videoSrc').addEventListener('input', (e) => {
    project.src = e.target.value
    persist()
  })
  field('fullSrc').addEventListener('input', (e) => {
    project.fullSrc = e.target.value
    persist()
  })
  field('poster').addEventListener('input', (e) => {
    project.poster = e.target.value
    persist()
  })

  field('src-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await handleFilePick(file, field('src'), (aspect) => {
      project.aspect = aspect
      project.src = field('src').value
      persist()
    })
  })
  field('poster-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await handleFilePick(file, field('poster'), () => {
      project.poster = field('poster').value
      persist()
    })
  })

  card.querySelector('[data-action="move-up"]').addEventListener('click', () => {
    if (index === 0) return
    ;[state.projects[index - 1], state.projects[index]] = [state.projects[index], state.projects[index - 1]]
    persist()
    renderProjects()
  })
  card.querySelector('[data-action="move-down"]').addEventListener('click', () => {
    if (index === state.projects.length - 1) return
    ;[state.projects[index + 1], state.projects[index]] = [state.projects[index], state.projects[index + 1]]
    persist()
    renderProjects()
  })
  card.querySelector('[data-action="remove"]').addEventListener('click', () => {
    if (!confirm(`Supprimer « ${project.title || 'ce projet'} » ?`)) return
    state.projects.splice(index, 1)
    persist()
    renderProjects()
  })

  renderExtras(card, project)
}

function renderExtras(card, item) {
  const extrasList = card.querySelector('[data-role="extras-list"]')
  const extraTemplate = document.getElementById('extra-row-template')
  extrasList.innerHTML = ''

  item._extras.forEach((extra, i) => {
    const node = extraTemplate.content.cloneNode(true)
    const row = node.querySelector('[data-role="extra-row"]')
    const srcInput = row.querySelector('[data-field="extra-src"]')
    const fileInput = row.querySelector('[data-field="extra-file"]')
    srcInput.value = extra.src

    srcInput.addEventListener('input', (e) => {
      extra.src = e.target.value
      persist()
    })
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      await handleFilePick(file, srcInput, (aspect) => {
        extra.aspect = aspect
        extra.src = srcInput.value
        persist()
      })
    })
    row.querySelector('[data-action="remove-extra"]').addEventListener('click', () => {
      item._extras.splice(i, 1)
      persist()
      renderExtras(card, item)
    })

    extrasList.appendChild(node)
  })

  card.querySelector('[data-action="add-extra"]').onclick = () => {
    item._extras.push({ _key: freshKey(), src: '', aspect: 1 })
    persist()
    renderExtras(card, item)
  }
}

// -----------------------------------------------------------------------
// Journal panel
// -----------------------------------------------------------------------
function renderJournal() {
  const list = document.getElementById('journal-list')
  list.innerHTML = ''
  const template = document.getElementById('journal-card-template')

  state.journal.forEach((entry, index) => {
    const node = template.content.cloneNode(true)
    const card = node.querySelector('[data-role="journal-card"]')
    card.dataset.key = entry._key
    bindJournalCard(card, entry, index)
    list.appendChild(node)
  })
}

function bindJournalCard(card, entry, index) {
  const field = (name) => card.querySelector(`[data-field="${name}"]`)
  const titlePreview = field('title-preview')
  const setPreview = () => {
    titlePreview.textContent = entry.title || '(sans titre)'
  }
  setPreview()

  ;['title', 'client', 'year', 'category', 'description', 'src'].forEach((key) => {
    field(key).value = entry[key]
    field(key).addEventListener('input', (e) => {
      entry[key] = e.target.value
      if (key === 'title') setPreview()
      persist()
    })
  })

  field('src-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await handleFilePick(file, field('src'), (aspect) => {
      entry.aspect = aspect
      entry.src = field('src').value
      persist()
    })
  })

  card.querySelector('[data-action="move-up"]').addEventListener('click', () => {
    if (index === 0) return
    ;[state.journal[index - 1], state.journal[index]] = [state.journal[index], state.journal[index - 1]]
    persist()
    renderJournal()
  })
  card.querySelector('[data-action="move-down"]').addEventListener('click', () => {
    if (index === state.journal.length - 1) return
    ;[state.journal[index + 1], state.journal[index]] = [state.journal[index], state.journal[index + 1]]
    persist()
    renderJournal()
  })
  card.querySelector('[data-action="remove"]').addEventListener('click', () => {
    if (!confirm(`Supprimer « ${entry.title || 'cette entrée'} » ?`)) return
    state.journal.splice(index, 1)
    persist()
    renderJournal()
  })

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
// triggered at once from the "Exporter" button — Chrome (and others) treat
// several programmatic downloads fired back-to-back as a flood and silently
// block everything after the first one. A genuine click per file sidesteps
// that entirely, and doubles as a way to re-grab one file without redoing
// the others.
function addDownloadStep(parent, label, onClick) {
  const li = document.createElement('li')
  const link = document.createElement('a')
  link.href = '#'
  link.innerHTML = label
  link.addEventListener('click', (e) => {
    e.preventDefault()
    onClick()
    link.style.opacity = '0.5'
  })
  li.appendChild(link)
  parent.appendChild(li)
}

function exportAll() {
  const steps = document.getElementById('export-steps')
  steps.innerHTML = ''

  const intro = document.createElement('li')
  intro.textContent = 'Clique chaque lien pour télécharger le fichier, puis place-le au bon endroit :'
  steps.appendChild(intro)

  addDownloadStep(steps, 'Télécharger <code>galleryData.js</code> → <code>src/data/</code>', () =>
    downloadTextFile('galleryData.js', buildGalleryDataFile()),
  )
  addDownloadStep(steps, 'Télécharger <code>journalData.js</code> → <code>src/data/</code>', () =>
    downloadTextFile('journalData.js', buildJournalDataFile()),
  )
  addDownloadStep(steps, 'Télécharger <code>siteSettings.js</code> → <code>src/data/</code>', () =>
    downloadTextFile('siteSettings.js', buildSiteSettingsFile()),
  )

  if (pendingFiles.size) {
    const imagesIntro = document.createElement('li')
    imagesIntro.innerHTML = `${pendingFiles.size} nouvelle(s) image(s) → <code>public/media/images/</code> :`
    steps.appendChild(imagesIntro)
    pendingFiles.forEach((file, path) => {
      const filename = path.split('/').pop()
      addDownloadStep(steps, `Télécharger <code>${filename}</code>`, () => downloadBinaryFile(filename, file))
    })
  }

  const outro = document.createElement('li')
  outro.textContent = 'Envoie ces fichiers pour que le site soit reconstruit et republié.'
  steps.appendChild(outro)

  document.getElementById('export-modal').hidden = false
}
