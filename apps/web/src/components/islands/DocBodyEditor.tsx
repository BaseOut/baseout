/**
 * DocBodyEditor — Plate rich-text editor for a document body
 * (openspec/changes/shared-schema-docs §5). React island, hydrated
 * client:visible inside DocsTab. The body is the Plate `Value` (opaque JSON to
 * the engine). Bold/Italic/Underline via the plugins' default hotkeys
 * (⌘B / ⌘I / ⌘U) — no custom toolbar, so no brittle transform-API coupling.
 */

import * as React from 'react'
import type { Value } from 'platejs'
import { Plate, PlateContent, usePlateEditor } from 'platejs/react'
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from '@platejs/basic-nodes/react'

const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }]

export interface DocBodyEditorProps {
  value?: Value | null
  onChange: (value: Value) => void
}

export default function DocBodyEditor({ value, onChange }: DocBodyEditorProps) {
  const editor = usePlateEditor({
    plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin],
    value: Array.isArray(value) && value.length > 0 ? value : EMPTY_VALUE,
  })

  return (
    <div className="rounded-box border border-base-300 bg-base-100">
      <Plate editor={editor} onChange={({ value: v }) => onChange(v)}>
        <PlateContent
          className="min-h-40 px-3 py-2 text-sm leading-relaxed focus:outline-none"
          placeholder="Write documentation… (⌘B bold, ⌘I italic, ⌘U underline)"
        />
      </Plate>
    </div>
  )
}
