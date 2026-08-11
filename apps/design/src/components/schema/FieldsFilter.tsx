/**
 * FieldsFilter — reusable hierarchical field-visibility filter (Base ▸ Table ▸ Field).
 *
 * A dropdown/popover that lets the user pick exactly which fields are shown in a schema
 * view. Presentational + callback-driven (per the client OpenSpec `field-visibility-filter`):
 * it takes the schema (bases/tables) + the current hidden-field set and emits the next set;
 * the consumer (Visualize) owns persistence and what "hidden" does (it drops the field row).
 *
 * Tree of tri-state checkboxes: a field is on/off; a table/base is checked when all its
 * fields are visible, unchecked when none, indeterminate when partial. Toggling a group
 * cascades to its fields. Search filters the tree (keeping ancestors) and bulk actions then
 * apply to the matches. Each field row carries its Airtable field-type icon.
 *
 * Visual chrome (trigger button, popover, in-popover search, Show/Hide-all) deliberately
 * matches the flat FacetDropdown twin in SchemaCanvas so the filters read as one family;
 * the difference is the hierarchy + tri-state checkboxes (toggles have no indeterminate).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SchemaTable } from './SchemaCanvas';
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';
import { fieldTypeLabel } from './schemaEntities';

export interface FieldsFilterProps {
  bases: { id: string; name: string }[];
  tables: SchemaTable[];
  /** Hidden field ids (the consumer's view state). */
  hidden: Set<string>;
  /** Emit the next hidden-field set. */
  onChange: (next: Set<string>) => void;
}

type TriState = 'on' | 'off' | 'mixed';

export default function FieldsFilter({ bases, tables, hidden, onChange }: FieldsFilterProps) {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Build the Base ▸ Table ▸ Field tree (only bases/tables that actually carry fields).
  const tree = useMemo(() => {
    const fallback = bases[0]?.id;
    return bases
      .map((b) => ({
        id: b.id,
        name: b.name,
        tables: tables
          .filter((t) => (t.baseId ?? fallback) === b.id)
          .map((t) => ({ id: t.id, name: t.name, fields: t.fields.filter((f) => !f.removed).map((f) => ({ id: f.id, name: f.name, type: f.type })) }))
          .filter((t) => t.fields.length),
      }))
      .filter((b) => b.tables.length);
  }, [bases, tables]);

  // Full-group id maps (counts are reported over the whole group, stable under search).
  const fullByBase = useMemo(() => {
    const m = new Map<string, string[]>();
    tree.forEach((b) => m.set(b.id, b.tables.flatMap((t) => t.fields.map((f) => f.id))));
    return m;
  }, [tree]);
  const allIds = useMemo(() => tree.flatMap((b) => b.tables.flatMap((t) => t.fields.map((f) => f.id))), [tree]);

  const ql = q.trim().toLowerCase();
  // Filtered tree: a base/table name match keeps its whole subtree; otherwise keep matching fields.
  const fTree = useMemo(() => {
    if (!ql) return tree;
    return tree.flatMap((b) => {
      if (b.name.toLowerCase().includes(ql)) return [b];
      const tbs = b.tables.flatMap((t) => {
        if (t.name.toLowerCase().includes(ql)) return [t];
        const fields = t.fields.filter((f) => f.name.toLowerCase().includes(ql) || fieldTypeLabel(f.type).toLowerCase().includes(ql));
        return fields.length ? [{ ...t, fields }] : [];
      });
      return tbs.length ? [{ ...b, tables: tbs }] : [];
    });
  }, [tree, ql]);

  const matchIds = useMemo(() => fTree.flatMap((b) => b.tables.flatMap((t) => t.fields.map((f) => f.id))), [fTree]);
  const scopeIds = ql ? matchIds : allIds; // bulk acts on matches when searching

  // --- selection math ---
  const stateOf = (ids: string[]): TriState => {
    if (!ids.length) return 'off';
    let vis = 0;
    for (const id of ids) if (!hidden.has(id)) vis++;
    return vis === 0 ? 'off' : vis === ids.length ? 'on' : 'mixed';
  };
  const count = (ids: string[]) => ({ vis: ids.reduce((n, id) => n + (hidden.has(id) ? 0 : 1), 0), total: ids.length });
  const apply = (ids: string[], hide: boolean) => {
    const next = new Set(hidden);
    if (hide) ids.forEach((id) => next.add(id));
    else ids.forEach((id) => next.delete(id));
    onChange(next);
  };
  // Tri-state click: on → hide all; off/mixed → show all.
  const toggleGroup = (ids: string[]) => apply(ids, stateOf(ids) === 'on');

  const globalState = stateOf(scopeIds);
  const totals = count(allIds);

  const toggleCollapse = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isOpen = (id: string) => ql !== '' || !collapsed.has(id); // search force-expands
  const setAllCollapsed = (c: boolean) => {
    if (!c) { setCollapsed(new Set()); return; }
    const all = new Set<string>();
    tree.forEach((b) => { all.add(b.id); b.tables.forEach((t) => all.add(t.id)); });
    setCollapsed(all);
  };

  const active = totals.vis < totals.total;
  const bulkLabel = ql ? ' matches' : '';

  return (
    <div className="dropdown">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm gap-1.5"
        style={
          active
            ? { background: 'color-mix(in oklch, var(--color-primary) 13%, transparent)', borderColor: 'color-mix(in oklch, var(--color-primary) 35%, transparent)', color: 'var(--color-primary)', boxShadow: 'none', fontWeight: 400 }
            : { background: 'var(--color-base-100)', borderColor: 'var(--color-base-300)', boxShadow: 'none', fontWeight: 400 }
        }
      >
        Field visibility
        {active && <span className="badge badge-sm badge-primary">{totals.vis}/{totals.total}</span>}
        <span aria-hidden style={{ width: 12, height: 12, display: 'grid', placeItems: 'center', opacity: 0.55 }}><Chevron /></span>
      </div>
      <div
        tabIndex={0}
        className="dropdown-content bg-base-100 rounded-box border border-base-300 shadow-lg"
        style={{ zIndex: 30, marginTop: 4, width: 304, padding: 8 }}
      >
        {/* search */}
        <label className="input input-sm" style={{ width: '100%' }}>
          <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center', opacity: 0.5 }}><Search /></span>
          <input type="text" placeholder="Search fields" aria-label="Search fields" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>

        {/* global bulk + expand/collapse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 1px 8px' }}>
          <button type="button" className="btn btn-xs btn-ghost gap-1 px-2" disabled={globalState === 'on'} onClick={() => apply(scopeIds, false)} style={globalState !== 'on' ? { color: 'var(--color-primary)' } : undefined}>{/* ds-ok: btn-xs matches the FacetDropdown / pattern-faceted-filter Show/Hide-all */}
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center' }}><Eye /></span>Show all{bulkLabel}
          </button>
          <button type="button" className="btn btn-xs btn-ghost gap-1 px-2" disabled={globalState === 'off'} onClick={() => apply(scopeIds, true)}>{/* ds-ok: faceted-filter Show/Hide-all parity */}
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center' }}><EyeOff /></span>Hide all{bulkLabel}
          </button>
          {!ql && (
            <button type="button" className="btn btn-xs btn-ghost px-1.5" style={{ marginLeft: 'auto', opacity: 0.7 }} onClick={() => setAllCollapsed(collapsed.size === 0)} aria-label={collapsed.size === 0 ? 'Collapse all groups' : 'Expand all groups'}>{/* ds-ok: faceted-filter parity */}
              {collapsed.size === 0 ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>

        {/* tree */}
        <div style={{ maxHeight: 320, overflowY: 'auto', margin: '0 -2px' }}>
          {fTree.length === 0 && <div style={{ padding: '8px 8px', fontSize: 12, opacity: 0.5 }}>No matches</div>}
          {fTree.map((b) => {
            const baseIds = fullByBase.get(b.id) ?? [];
            const baseShown = b.tables.flatMap((t) => t.fields.map((f) => f.id)); // scoped to filtered view
            const bc = count(baseIds);
            const open = isOpen(b.id);
            return (
              <div key={b.id} style={{ marginBottom: 2 }}>
                <Row
                  indent={0}
                  open={open}
                  onCaret={() => toggleCollapse(b.id)}
                  state={stateOf(baseShown)}
                  onToggle={() => toggleGroup(baseShown)}
                  icon={<span aria-hidden className="concept-ic-base" style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', opacity: 0.6 }}><DatabaseGlyph /></span>}
                  label={b.name}
                  emphasis="base"
                  countText={`${bc.vis}/${bc.total}`}
                />
                {open && b.tables.map((t) => {
                  const tShown = t.fields.map((f) => f.id);
                  const tFull = tree.find((x) => x.id === b.id)?.tables.find((x) => x.id === t.id)?.fields.map((f) => f.id) ?? tShown;
                  const tc = count(tFull);
                  const topen = isOpen(t.id);
                  return (
                    <div key={t.id}>
                      <Row
                        indent={1}
                        open={topen}
                        onCaret={() => toggleCollapse(t.id)}
                        state={stateOf(tShown)}
                        onToggle={() => toggleGroup(tShown)}
                        icon={<span aria-hidden className="concept-ic-table" style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', opacity: 0.6 }}><TableGlyph /></span>}
                        label={t.name}
                        emphasis="table"
                        countText={`${tc.vis}/${tc.total}`}
                      />
                      {topen && t.fields.map((f) => (
                        <Row
                          key={f.id}
                          indent={2}
                          state={hidden.has(f.id) ? 'off' : 'on'}
                          onToggle={() => apply([f.id], !hidden.has(f.id) ? true : false)}
                          icon={<FieldTypeIcon type={f.type} />}
                          label={f.name}
                          dim={hidden.has(f.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* — one tree row: optional caret, tri-state checkbox, icon, label, optional count — */
function Row({ indent, open, onCaret, state, onToggle, icon, label, countText, emphasis, dim }: {
  indent: 0 | 1 | 2;
  open?: boolean;
  onCaret?: () => void;
  state: TriState;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  countText?: string;
  emphasis?: 'base' | 'table';
  dim?: boolean;
}) {
  const hasCaret = onCaret != null;
  return (
    <div
      className="hover:bg-base-200"
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 7, paddingLeft: 6 + indent * 16, opacity: dim ? 0.5 : 1, transition: 'opacity .12s ease' }}
    >
      {hasCaret ? (
        <button type="button" onClick={onCaret} aria-label={open ? 'Collapse' : 'Expand'} style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--color-base-content)', opacity: 0.55, background: 'none', border: 0, cursor: 'pointer', padding: 0, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .12s ease' }}>
          <Chevron />
        </button>
      ) : (
        <span style={{ width: 14, flex: 'none' }} />
      )}
      <TriCheckbox state={state} onChange={onToggle} label={label} />
      {icon}
      <span
        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: emphasis ? 600 : 500, cursor: 'default' }}
      >
        {label}
      </span>
      {countText && <span className="mono-data" style={{ fontSize: 10.5, opacity: 0.5, flex: 'none' }}>{countText}</span>}
    </div>
  );
}

function TriCheckbox({ state, onChange, label }: { state: TriState; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === 'mixed'; }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="checkbox checkbox-sm"
      style={{ flex: 'none' }}
      checked={state === 'on'}
      onChange={onChange}
      aria-label={`Show ${label}`}
      aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
    />
  );
}

function FieldTypeIcon({ type }: { type: string }) {
  const k = airtableIconKey(type);
  if (!k) return <span aria-hidden style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', opacity: 0.5 }}><DotGlyph /></span>;
  return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden style={{ flex: 'none', opacity: 0.72 }} dangerouslySetInnerHTML={{ __html: AIRTABLE_FIELD_ICONS[k] }} />;
}

/* — local glyphs (kept minimal; type icons come from the vendored Airtable set) — */
function Chevron() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>);
}
function Search() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>);
}
function Eye() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></svg>);
}
function EyeOff() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.7 5.1A11 11 0 0 1 12 5c5 0 9.27 3.11 11 7a11.7 11.7 0 0 1-2.2 3.4M6.6 6.6A11.7 11.7 0 0 0 1 12c1.73 3.89 6 7 11 7a11 11 0 0 0 5.4-1.4M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
}
function DatabaseGlyph() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>);
}
function TableGlyph() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 9h18M3 15h18" /><rect x="3" y="3" width="18" height="18" rx="2" /></svg>);
}
function DotGlyph() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>);
}
