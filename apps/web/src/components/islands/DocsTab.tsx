/**
 * DocsTab — the self-contained Schema Docs authoring island
 * (openspec/changes/shared-schema-docs §5). Owns the document list, the editor
 * (Plate body + entity tags + links + React Flow mini-diagrams), and all CRUD
 * against the authenticated /api/spaces/:spaceId/* proxy routes. The browser
 * never touches the per-Space DB. Mounted client:visible in SchemaView so the
 * Plate + React Flow bundle loads only when the Docs tab is opened.
 */

import * as React from 'react'
import type { Value } from 'platejs'
import type { SchemaDoc, SchemaDocSummary, SchemaDocTargetType } from '../../lib/backup-engine'
import {
  addTagUnique,
  seedDiagramNodes,
  toEditorState,
  type EditorDiagram,
  type EditorLink,
  type EditorState,
} from '../../lib/schema-docs/editor-logic'
import DocBodyEditor from './DocBodyEditor'
import DocDiagram from './DocDiagram'

export interface DocsTabEntity {
  type: SchemaDocTargetType
  id: string
  label: string
}

export interface DocsTabProps {
  spaceId: string
  initialDocs: SchemaDocSummary[]
  aiEnabled: boolean
  entities: DocsTabEntity[]
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

export default function DocsTab({ spaceId, initialDocs, aiEnabled, entities }: DocsTabProps) {
  const base = `/api/spaces/${spaceId}`
  const entityLabel = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const e of entities) m.set(`${e.type}:${e.id}`, e.label)
    return m
  }, [entities])

  const [docs, setDocs] = React.useState<SchemaDocSummary[]>(initialDocs)
  const [editor, setEditor] = React.useState<EditorState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newTitle, setNewTitle] = React.useState('')

  const refreshList = React.useCallback(async () => {
    const res = await fetch(`${base}/documents`)
    if (res.ok) {
      const data = (await res.json()) as { documents: SchemaDocSummary[] }
      setDocs(data.documents)
    }
  }, [base])

  async function openDoc(id: string) {
    setError(null)
    const res = await fetch(`${base}/documents/${id}`)
    if (!res.ok) return setError('Could not load the document.')
    const data = (await res.json()) as { document: SchemaDoc }
    setEditor(toEditorState(data.document))
  }

  async function createDoc(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${base}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: [{ type: 'p', children: [{ text: '' }] }] }),
      })
      if (!res.ok) return setError('Could not create the document.')
      const data = (await res.json()) as { document: SchemaDoc }
      setNewTitle('')
      await refreshList()
      setEditor(toEditorState(data.document))
    } finally {
      setBusy(false)
    }
  }

  async function saveDoc() {
    if (!editor) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${base}/documents/${editor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editor.title,
          body: editor.body,
          tags: editor.tags.map((t) => ({ targetType: t.targetType, targetId: t.targetId, addedVia: t.addedVia })),
          links: editor.links.filter((l) => l.url.trim()),
          diagrams: editor.diagrams.map((d) => ({ name: d.name, state: d.state })),
        }),
      })
      if (!res.ok) return setError('Could not save the document.')
      await refreshList()
      setEditor(null)
    } finally {
      setBusy(false)
    }
  }

  async function deleteDoc() {
    if (!editor) return
    if (!confirm('Delete this document? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`${base}/documents/${editor.id}`, { method: 'DELETE' })
      if (!res.ok) return setError('Could not delete the document.')
      await refreshList()
      setEditor(null)
    } finally {
      setBusy(false)
    }
  }

  // ── editor field mutators ────────────────────────────────────
  const patchEditor = (p: Partial<EditorState>) => setEditor((e) => (e ? { ...e, ...p } : e))

  function addTag(key: string) {
    if (!editor || !key) return
    const [type, id] = key.split(':') as [SchemaDocTargetType, string]
    patchEditor({ tags: addTagUnique(editor.tags, type, id) })
  }
  const removeTag = (i: number) => editor && patchEditor({ tags: editor.tags.filter((_, idx) => idx !== i) })

  const addLink = () => editor && patchEditor({ links: [...editor.links, { name: '', url: '' }] })
  const setLink = (i: number, p: Partial<EditorLink>) =>
    editor && patchEditor({ links: editor.links.map((l, idx) => (idx === i ? { ...l, ...p } : l)) })
  const removeLink = (i: number) => editor && patchEditor({ links: editor.links.filter((_, idx) => idx !== i) })

  function addDiagram() {
    if (!editor) return
    // Seed a node per tagged table so the author starts from their tagged entities.
    const nodes = seedDiagramNodes(editor.tags, (key) => entityLabel.get(key) ?? key)
    patchEditor({
      diagrams: [...editor.diagrams, { name: `Diagram ${editor.diagrams.length + 1}`, state: { nodes, edges: [] } }],
    })
  }
  const setDiagram = (i: number, p: Partial<EditorDiagram>) =>
    editor && patchEditor({ diagrams: editor.diagrams.map((d, idx) => (idx === i ? { ...d, ...p } : d)) })
  const removeDiagram = (i: number) =>
    editor && patchEditor({ diagrams: editor.diagrams.filter((_, idx) => idx !== i) })

  // ── render ───────────────────────────────────────────────────
  if (editor) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditor(null)}>
            ← Back to documents
          </button>
          <div className="flex items-center gap-2">
            {aiEnabled && (
              <button type="button" className="btn btn-soft btn-sm" disabled title="Coming soon">
                Generate with AI
                <span className="badge badge-secondary badge-sm">Soon</span>
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm text-error" onClick={deleteDoc} disabled={busy}>
              Delete
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveDoc} disabled={busy}>
              {busy && <span className="loading loading-spinner loading-sm" />}
              Save
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        <input
          className="input input-bordered w-full text-lg font-semibold"
          value={editor.title}
          onChange={(e) => patchEditor({ title: e.target.value })}
          placeholder="Document title"
        />

        <DocBodyEditor value={editor.body as Value} onChange={(body) => patchEditor({ body })} />

        <section>
          <h3 className="mb-2 text-sm font-semibold">Tagged entities</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            {editor.tags.length === 0 && <span className="text-sm text-base-content/40">None yet.</span>}
            {editor.tags.map((t, i) => (
              <span
                key={`${t.targetType}:${t.targetId}`}
                className={`badge gap-1 ${t.entityRemoved ? 'badge-warning' : 'badge-ghost'}`}
              >
                {entityLabel.get(`${t.targetType}:${t.targetId}`) ?? `${t.targetType}:${t.targetId}`}
                {t.entityRemoved && ' · removed'}
                <button type="button" className="ml-1" onClick={() => removeTag(i)} aria-label="Remove tag">
                  ✕
                </button>
              </span>
            ))}
          </div>
          <select
            className="select select-bordered select-sm w-full max-w-md"
            value=""
            onChange={(e) => addTag(e.target.value)}
          >
            <option value="">Tag an entity…</option>
            {entities.map((e) => (
              <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>
                {e.type}: {e.label}
              </option>
            ))}
          </select>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Links</h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={addLink}>
              + Add link
            </button>
          </div>
          <ul className="space-y-2">
            {editor.links.length === 0 && <li className="text-sm text-base-content/40">None.</li>}
            {editor.links.map((l, i) => (
              <li key={i} className="flex gap-2">
                <input
                  className="input input-bordered input-sm w-40"
                  placeholder="Name"
                  value={l.name}
                  onChange={(e) => setLink(i, { name: e.target.value })}
                />
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="https://…"
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLink(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Mini-diagrams</h3>
            <button type="button" className="btn btn-ghost btn-xs" onClick={addDiagram}>
              + Add diagram
            </button>
          </div>
          <div className="space-y-4">
            {editor.diagrams.length === 0 && (
              <p className="text-sm text-base-content/40">
                Add a diagram to sketch how the tagged tables relate.
              </p>
            )}
            {editor.diagrams.map((d, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center gap-2">
                  <input
                    className="input input-bordered input-xs w-48"
                    value={d.name}
                    onChange={(e) => setDiagram(i, { name: e.target.value })}
                  />
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeDiagram(i)}>
                    Remove
                  </button>
                </div>
                <DocDiagram initial={d.state} onChange={(state) => setDiagram(i, { state })} />
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-base-content/60">Team-authored documentation about this Space’s schema.</p>
        <form className="flex items-center gap-2" onSubmit={createDoc}>
          <input
            className="input input-bordered input-sm w-56"
            placeholder="New document title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !newTitle.trim()}>
            {busy && <span className="loading loading-spinner loading-sm" />}
            New document
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

      {docs.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 p-10 text-center">
          <p className="font-semibold">No documents yet</p>
          <p className="mt-1 text-sm text-base-content/60">
            Write your first document to capture conventions, ownership, and gotchas about your schema.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 rounded-box border border-base-300/60 bg-base-100 p-4 text-left hover:bg-base-200"
                onClick={() => openDoc(doc.id)}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{doc.title}</span>
                  {doc.excerpt && <span className="mt-1 block truncate text-sm text-base-content/60">{doc.excerpt}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {doc.tagCount > 0 && <span className="badge badge-primary badge-sm">{doc.tagCount} tagged</span>}
                  <span className="text-xs text-base-content/40">{fmtDate(doc.updatedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
