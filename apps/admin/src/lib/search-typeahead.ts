// Client typeahead for the top-bar omnisearch (admin-crm-ux Task 4.3).
// Progressive enhancement only — the <form> GET → /search works without any of
// this. Debounced fetch to /api/search/suggest, grouped dropdown, keyboard nav
// (↑/↓ move, Enter navigates or submits, Esc closes), and a Cmd/Ctrl+K or `/`
// focus shortcut. Results are rendered via textContent (never innerHTML) so a
// user-controlled org/space name can never inject markup.

interface SuggestRow {
  id: string
  label: string
  context: string | null
  href: string | null
}
interface SuggestGroup {
  key: string
  label: string
  rows: SuggestRow[]
}

export function initSearchTypeahead(): void {
  const input = document.querySelector<HTMLInputElement>('[data-search-input]')
  const dropdown = document.querySelector<HTMLElement>('[data-suggest]')
  const form = document.querySelector<HTMLFormElement>('[data-search-form]')
  if (!input || !dropdown || !form) return

  let hrefs: string[] = [] // navigable targets, dropdown order
  let active = -1 // highlighted index into hrefs
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0 // guards out-of-order fetch responses

  const close = () => {
    dropdown.classList.add('hidden')
    dropdown.replaceChildren()
    input.setAttribute('aria-expanded', 'false')
    hrefs = []
    active = -1
  }

  const highlight = (next: number) => {
    const items = dropdown.querySelectorAll<HTMLElement>('[data-suggest-row]')
    if (items.length === 0) return
    active = (next + items.length) % items.length
    items.forEach((el, i) => el.classList.toggle('bg-base-200', i === active))
  }

  const render = (groups: SuggestGroup[]) => {
    dropdown.replaceChildren()
    hrefs = []
    active = -1
    if (groups.length === 0) {
      close()
      return
    }
    let rowIndex = 0
    for (const group of groups) {
      const header = document.createElement('div')
      header.className = 'px-3 pt-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/40'
      header.textContent = group.label
      dropdown.appendChild(header)
      for (const row of group.rows) {
        if (!row.href) continue
        const a = document.createElement('a')
        a.href = row.href
        a.dataset.suggestRow = ''
        a.setAttribute('role', 'option')
        a.className = 'flex flex-col gap-0.5 px-3 py-1.5 hover:bg-base-200'
        const label = document.createElement('span')
        label.className = 'text-sm'
        label.textContent = row.label
        a.appendChild(label)
        if (row.context) {
          const ctx = document.createElement('span')
          ctx.className = 'text-xs text-base-content/50'
          ctx.textContent = row.context
          a.appendChild(ctx)
        }
        dropdown.appendChild(a)
        hrefs.push(row.href)
        rowIndex++
      }
    }
    if (rowIndex === 0) {
      close()
      return
    }
    dropdown.classList.remove('hidden')
    input.setAttribute('aria-expanded', 'true')
  }

  const fetchSuggest = async (q: string) => {
    const mine = ++seq
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } })
      if (!res.ok || mine !== seq) return
      const data = (await res.json()) as { groups?: SuggestGroup[] }
      if (mine !== seq) return
      render(data.groups ?? [])
    } catch {
      // Network/parse failure → silently fall back to the plain form submit.
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim()
    if (timer) clearTimeout(timer)
    if (q.length < 1) {
      close()
      return
    }
    timer = setTimeout(() => void fetchSuggest(q), 200)
  })

  input.addEventListener('keydown', (e) => {
    if (dropdown.classList.contains('hidden')) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlight(active + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlight(active - 1)
    } else if (e.key === 'Enter') {
      if (active >= 0 && hrefs[active]) {
        e.preventDefault()
        window.location.href = hrefs[active]
      }
      // else: let the form submit to /search (no-selection behavior)
    } else if (e.key === 'Escape') {
      close()
    }
  })

  // Close on outside click.
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target as Node)) close()
  })

  // Focus shortcut: Cmd/Ctrl+K anywhere, or `/` when not already typing.
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      input.focus()
      input.select()
    } else if (e.key === '/' && !typing) {
      e.preventDefault()
      input.focus()
    }
  })
}
