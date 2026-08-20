/**
 * viewState — the ONE controller that puts a section's view state in the query string.
 *
 * WHY IT EXISTS. `sectionTabs.ts` already made a tab addressable, and the catalog's
 * `pattern-section-tabs` says why: a position nothing outside the page can point at has to be
 * described in prose ("open Attachments, search invoice, group by base") instead of sent as a link.
 * Everything BELOW the tab had the same problem and no equivalent: the Data tabs' search, facets
 * and grouping lived only in closure variables, so a found attachment could not be handed to a
 * colleague, and a reload after four filter choices came back to an unfiltered list.
 *
 * WHAT IT OWNS.
 *  · `restore()` — read the URL once, before the first paint, and drive the CONTROLS (not the
 *    host's private variables) back to what it says. Each control then emits the change event it
 *    always emits, so the host updates through the path it already had; nothing new re-implements
 *    filtering. A param naming an option this page does not have is skipped, so a stale link
 *    degrades to a working page rather than an empty one.
 *  · `sync()` — write the current values back with `history.replaceState`. REPLACE, for exactly the
 *    reason `sectionTabs` documents: Back must leave the section, not undo one keystroke of a search
 *    box. A field sitting at its default is DELETED from the URL, never written as an empty value —
 *    the address of an untouched page is the bare page.
 *
 * WHAT IT DOES NOT OWN. The `?tab=` param (that is `sectionTabs`) and any key not declared to it.
 * It rewrites only its own fields, so two controllers on one page cannot erase each other.
 */

export interface ViewStateField {
  /** The query-string key. Unique across every field wired on one page. */
  key: string
  /** Current value, or `''` when the control is at its default. `''` is never written. */
  get: () => string
  /** Drive the control to `value`. Called once, from `restore()`, before the first render. */
  set: (value: string) => void
}

export interface ViewStateApi {
  /** Apply the URL to the controls. Returns the keys it actually consumed. */
  restore: () => string[]
  /** Write the controls back to the URL. */
  sync: () => void
}

export function wireViewState(fields: ViewStateField[]): ViewStateApi {
  const restore = (): string[] => {
    const used: string[] = []
    let params: URLSearchParams
    try {
      params = new URLSearchParams(window.location.search)
    } catch {
      return used
    }
    fields.forEach((f) => {
      const v = params.get(f.key)
      if (v === null || v === '') return
      f.set(v)
      used.push(f.key)
    })
    return used
  }

  const sync = (): void => {
    try {
      const url = new URL(window.location.href)
      fields.forEach((f) => {
        const v = f.get()
        if (v) url.searchParams.set(f.key, v)
        else url.searchParams.delete(f.key)
      })
      history.replaceState(history.state, '', url)
    } catch {
      // A malformed URL is not worth breaking a filter change over.
    }
  }

  return { restore, sync }
}

/* ── Adapters for the shared controls ──────────────────────────────────────── */

/**
 * A MULTI-select `FacetFilter` (`name` = its `data-facet`).
 *
 * The URL carries what is SELECTED, not what is hidden, even though the hosts hold hidden sets.
 * Two reasons: "show me these three bases" is what a person means when they send the link, and it
 * is the safe reading when the recipient's data differs — an option the sender never saw stays out,
 * where an exclusion list would have silently let it in. Nothing is written while every option is
 * on, because that is the default and the default is the bare URL.
 */
export function facetField(root: HTMLElement, key: string, name = key): ViewStateField {
  const ff = () => root.querySelector<HTMLElement>(`.ff[data-facet="${name}"]`)
  const opts = () => Array.from(ff()?.querySelectorAll<HTMLInputElement>('[data-facet-opt]') ?? [])
  return {
    key,
    get: () => {
      const all = opts()
      if (!all.length) return ''
      const on = all.filter((o) => o.checked)
      return on.length === all.length ? '' : on.map((o) => o.value).join(',')
    },
    set: (value) => {
      const el = ff()
      if (!el) return
      const wanted = new Set(value.split(',').filter(Boolean))
      // A value naming nothing on this page would blank the facet — leave the control alone and
      // let the page render unfiltered rather than empty.
      if (!opts().some((o) => wanted.has(o.value))) return
      el.dispatchEvent(new CustomEvent('facetset', { detail: { selected: [...wanted] } }))
    },
  }
}

/** A SINGLE-select `FacetFilter` (group-by, a threshold). Its first option is the default. */
export function facetSingleField(root: HTMLElement, key: string, name = key): ViewStateField {
  const ff = () => root.querySelector<HTMLElement>(`.ff[data-facet="${name}"]`)
  const opts = () => Array.from(ff()?.querySelectorAll<HTMLInputElement>('[data-facet-opt]') ?? [])
  return {
    key,
    get: () => {
      const all = opts()
      const sel = all.find((o) => o.checked)
      if (!sel || sel === all[0]) return ''
      return sel.value
    },
    set: (value) => {
      const el = ff()
      if (!el || !opts().some((o) => o.value === value)) return
      el.dispatchEvent(new CustomEvent('facetset', { detail: { value } }))
    },
  }
}

/**
 * A `DateRangePicker` (`name` = its `data-dr`), encoded as `from..to` with either end open —
 * `2026-07-07..2026-07-14`, `2026-07-07..`, `..2026-07-14`. The dates ARE the state; which preset
 * button produced them is not (see the picker's `facetset` note).
 */
export function dateRangeField(root: HTMLElement, key: string, name = key): ViewStateField {
  const dr = () => root.querySelector<HTMLElement>(`[data-dr="${name}"]`)
  const val = (sel: string) => dr()?.querySelector<HTMLInputElement>(sel)?.value ?? ''
  return {
    key,
    get: () => {
      const from = val('[data-dr-from]')
      const to = val('[data-dr-to]')
      return from || to ? `${from}..${to}` : ''
    },
    set: (value) => {
      const el = dr()
      if (!el || !value.includes('..')) return
      const [from, to] = value.split('..')
      el.dispatchEvent(new CustomEvent('facetset', { detail: { from, to } }))
    },
  }
}

/**
 * A text input whose host listens for `input`. Restoring dispatches the same `input` event a
 * keystroke does, so the host's own handler is the only thing that reads the value.
 */
export function inputField(key: string, el: HTMLInputElement | null): ViewStateField {
  return {
    key,
    get: () => el?.value.trim() ?? '',
    set: (value) => {
      if (!el) return
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
  }
}
