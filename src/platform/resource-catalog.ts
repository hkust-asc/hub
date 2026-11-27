import catalog from './resource-catalog.json' with { type: 'json' }

type ResourceFormat = 'recording' | 'summary' | 'slides' | 'reference'

interface ResourceLink {
  label: string
  href: string
  format: ResourceFormat
}

export interface ResourceInfo {
  title: string
  source: string
  use: string
  date?: string
  topics?: readonly string[]
}

export interface ResourceEntry extends ResourceInfo {
  links: readonly ResourceLink[]
}

export interface WorkshopResource extends ResourceEntry {
  id: string
  weekId?: string
}

interface ResourceCollection extends ResourceInfo {
  id: string
  courses: readonly WorkshopResource[]
}

export type ResourcePage = WorkshopResource | ResourceCollection

function readLink(label: string, href: string, format = 'reference'): ResourceLink {
  if (format !== 'reference' && format !== 'recording' && format !== 'summary' && format !== 'slides') {
    throw new Error(`Unknown resource link format "${format}" for "${label}"`)
  }
  const url = new URL(href)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`Resource link "${label}" must use HTTPS without credentials`)
  }
  return { label, href, format }
}

function readLinks(links: readonly { label: string; href: string; format?: string }[]) {
  return links.map(({ label, href, format }) => readLink(label, href, format))
}

export const resourceSetup: ResourceEntry = { ...catalog.setup, links: readLinks(catalog.setup.links) }
export const workshopResources: readonly WorkshopResource[] = catalog.workshops.map(workshop => ({
  ...workshop, links: readLinks(workshop.links),
}))
export const resourceCollections: readonly ResourceCollection[] = catalog.collections.map(collection => ({
  ...collection,
  courses: collection.courses.map(course => ({ ...course, source: collection.source, links: readLinks(course.links) })),
}))
export const resourceReferences: readonly ResourceEntry[] = catalog.references.map(({ href, format, ...reference }) => ({
  ...reference, links: [readLink('Open resource', href, format)],
}))

export const resourcePages: readonly ResourcePage[] = [...workshopResources, ...resourceCollections]

export function getResourcePage(id: string) {
  return resourcePages.find(page => page.id === id || ('courses' in page && page.courses.some(course => course.id === id)))
}

export function resourcePageTitle(id?: string) {
  if (id === undefined) return 'Resources'
  const page = getResourcePage(id)
  if (!page) throw new Error(`Unknown resource page "${id}"`)
  return 'courses' in page ? page.title : `${page.title} materials`
}

export function resourcesRoute(detail?: string) {
  return detail ? `#resources/${detail}` : '#resources'
}
