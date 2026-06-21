import { useEffect } from 'react'

interface SeoMetaOptions {
  canonicalPath?: string
  description: string
  title: string
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.content = content
}

function upsertCanonical(canonicalPath: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }

  element.href = new URL(canonicalPath, window.location.origin).toString()
}

export function useSeoMeta({ canonicalPath, description, title }: SeoMetaOptions) {
  useEffect(() => {
    document.title = title

    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', 'Worldian')
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)

    if (canonicalPath) {
      upsertCanonical(canonicalPath)
      upsertMeta('property', 'og:url', new URL(canonicalPath, window.location.origin).toString())
    }
  }, [canonicalPath, description, title])
}
