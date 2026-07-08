/**
 * Client wiring for SchemaChat.astro (the Schema Chat tab). Kept out of the
 * frontmatter (frontmatter-thin). All interactions are FAKED (no backend):
 * thread switch / new / rename / archive, context-scope chips (add via
 * EntitySearch + doc picker, remove), send → canned streamed reply, convert to
 * doc → linked reference card. Entity refs open the shared EntityPanel; doc refs
 * switch to the Docs tab and open the doc.
 */
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fieldIconSvg = (type?: string) => {
  const k = type ? airtableIconKey(type) : null;
  return k ? `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">${AIRTABLE_FIELD_ICONS[k]}</svg>` : '';
};

interface Ref { kind: 'entity' | 'doc'; id: string; name: string; entityKind?: string; fieldType?: string }
const refIcon = (r: Ref) =>
  r.kind === 'doc' ? '<span class="iconify lucide--file-text"></span>'
  : r.entityKind === 'field' ? fieldIconSvg(r.fieldType) || '<span class="iconify lucide--tag"></span>'
  : r.entityKind === 'table' ? '<span class="iconify lucide--table-2"></span>'
  : '<span class="iconify lucide--database concept-ic-base"></span>';
const chipHtml = (r: Ref, removable = false) =>
  `<span class="chat-chip" data-chat-chip data-ref-kind="${r.kind}" data-ref-id="${esc(r.id)}">` +
  `<button type="button" class="chat-chip-open" ${r.kind === 'doc' ? `data-doc-open="${esc(r.id)}"` : `data-entity-open="${esc(r.id)}"`}>` +
  `<span class="chat-chip-ic">${refIcon(r)}</span><span class="chat-chip-name">${esc(r.name)}</span></button>` +
  (removable ? '<button type="button" class="chat-chip-x" data-chip-remove aria-label="Remove from context"><span class="iconify lucide--x size-3"></span></button>' : '') +
  '</span>';

export function wireChat() {
  const root = document.querySelector<HTMLElement>('[data-chat]');
  if (!root || root.dataset.chatWired) return;
  root.dataset.chatWired = '1';
  if (root.dataset.canChat !== '1') return; // gated — nothing to wire

  // per-thread scope (entity + doc chips)
  const scopeByThread: Record<string, Ref[]> = {};
  try { Object.assign(scopeByThread, JSON.parse(document.querySelector<HTMLElement>('[data-chat-scope]')?.textContent || '{}')); } catch { /* none */ }

  const threadsWrap = root.querySelector<HTMLElement>('[data-chat-threads]');
  const ctxChips = root.querySelector<HTMLElement>('[data-chat-context-chips]');
  let activeId = root.querySelector<HTMLElement>('.chat-trow.is-active')?.dataset.chatTrow
    || root.querySelector<HTMLElement>('[data-chat-trow]')?.dataset.chatTrow
    || '';

  const panel = (id: string) => root.querySelector<HTMLElement>(`[data-chat-thread="${CSS.escape(id)}"]`);
  const convo = () => panel(activeId)?.querySelector<HTMLElement>('[data-chat-convo]');
  const scrollDown = () => { const c = convo(); if (c) c.scrollTop = c.scrollHeight; };

  const renderContext = () => {
    if (!ctxChips) return;
    const scope = scopeByThread[activeId] || [];
    ctxChips.innerHTML = scope.length === 0
      ? '<span class="chat-context-whole"><span class="iconify lucide--globe size-3.5" aria-hidden="true"></span>Whole Space</span>'
      : scope.map((r) => chipHtml(r, true)).join('');
  };

  const topbarTitle = root.querySelector<HTMLElement>('[data-chat-topbar-title]');
  const selectThread = (id: string) => {
    if (!id) return;
    activeId = id;
    root.querySelectorAll<HTMLElement>('[data-chat-thread]').forEach((p) => (p.hidden = p.dataset.chatThread !== id));
    root.querySelectorAll<HTMLElement>('.chat-trow').forEach((r) => {
      const on = r.dataset.chatTrow === id;
      r.classList.toggle('is-active', on);
      r.querySelector('[data-chat-open]')?.setAttribute('aria-selected', String(on));
    });
    const title = root.querySelector<HTMLElement>(`[data-chat-trow="${CSS.escape(id)}"] [data-chat-title], [data-chat-trow="${CSS.escape(id)}"] .chat-trow-title`)?.textContent;
    if (topbarTitle && title) topbarTitle.textContent = title;
    renderContext();
    scrollDown();
    syncScrollBtn();
  };
  // assistant footer (marker + actions) — mirrors the frontmatter msgActions
  const msgActions = '<div class="chat-msg-foot"><span class="chat-msg-mark"><span class="iconify lucide--sparkles size-3.5" aria-hidden="true"></span></span><div class="chat-msg-acts"><button type="button" class="chat-act" data-chat-copy aria-label="Copy"><span class="iconify lucide--copy size-3.5" aria-hidden="true"></span></button><button type="button" class="chat-act" aria-label="Good response"><span class="iconify lucide--thumbs-up size-3.5" aria-hidden="true"></span></button><button type="button" class="chat-act" aria-label="Bad response"><span class="iconify lucide--thumbs-down size-3.5" aria-hidden="true"></span></button></div></div>';

  // Open a specific thread from elsewhere (e.g. the EntityPanel "Referenced by ▸ Chats" jump).
  // The caller activates the Chat tab first; this just selects the thread inside it.
  document.addEventListener('schema:openChat', (ev) => {
    const id = (ev as CustomEvent).detail?.id;
    if (id) selectThread(id);
  });

  // ── thread rail: open / rename / archive / restore ──
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const open = t.closest<HTMLElement>('[data-chat-open]');
    if (open) { selectThread(open.dataset.chatOpen!); return; }
    const ren = t.closest<HTMLElement>('[data-chat-rename]');
    if (ren) {
      const row = root.querySelector<HTMLElement>(`[data-chat-trow="${CSS.escape(ren.dataset.chatRename!)}"]`);
      const titleEl = row?.querySelector<HTMLElement>('[data-chat-title]');
      const next = window.prompt('Rename chat', titleEl?.textContent || '');
      if (next && titleEl) titleEl.textContent = next.trim() || titleEl.textContent;
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    const arc = t.closest<HTMLElement>('[data-chat-archive]');
    if (arc) { archiveThread(arc.dataset.chatArchive!); (document.activeElement as HTMLElement | null)?.blur(); return; }
    const res = t.closest<HTMLElement>('[data-chat-restore]');
    if (res) { restoreThread(res.dataset.chatRestore!); return; }
  });

  const archToggle = root.querySelector<HTMLInputElement>('[data-chat-show-archived]');
  const archList = root.querySelector<HTMLElement>('[data-chat-arc-list]');
  archToggle?.addEventListener('change', () => { if (archList) archList.hidden = !archToggle.checked; });

  function archiveThread(id: string) {
    const row = root.querySelector<HTMLElement>(`.chat-threads [data-chat-trow="${CSS.escape(id)}"]`);
    if (!row) return;
    row.remove();
    panel(id)?.setAttribute('hidden', '');
    // move to the archived list (simple restore-able stub)
    if (archList) {
      const title = row.querySelector('[data-chat-title]')?.textContent || 'Chat';
      const arcRow = document.createElement('div');
      arcRow.className = 'chat-trow chat-trow-arc';
      arcRow.dataset.chatTrow = id;
      arcRow.innerHTML = `<button type="button" class="chat-trow-main" data-chat-open="${esc(id)}"><span class="iconify lucide--archive size-3.5 chat-trow-ic" aria-hidden="true"></span><span class="chat-trow-title">${esc(title)}</span></button><button type="button" class="btn btn-sm btn-ghost chat-trow-restore" data-chat-restore="${esc(id)}">Restore</button>`;
      archList.appendChild(arcRow);
    }
    // ensure an archived toggle exists / is visible
    if (archToggle) archToggle.closest('label')?.removeAttribute('hidden');
    // select another active thread
    const next = root.querySelector<HTMLElement>('.chat-threads [data-chat-trow]')?.dataset.chatTrow || '';
    if (next) selectThread(next);
  }
  function restoreThread(id: string) {
    const arcRow = archList?.querySelector<HTMLElement>(`[data-chat-trow="${CSS.escape(id)}"]`);
    if (!arcRow || !threadsWrap) return;
    arcRow.remove();
    const row = document.createElement('div');
    row.className = 'chat-trow';
    row.dataset.chatTrow = id;
    const title = arcRow.querySelector('.chat-trow-title')?.textContent || 'Chat';
    row.innerHTML = railRowInner(id, title);
    threadsWrap.querySelector('[data-chat-rail-empty]')?.before(row);
    selectThread(id);
  }

  const railRowInner = (id: string, title: string) =>
    `<button type="button" class="chat-trow-main" data-chat-open="${esc(id)}" role="tab"><span class="iconify lucide--message-square size-3.5 chat-trow-ic" aria-hidden="true"></span><span class="chat-trow-title" data-chat-title>${esc(title)}</span><span class="chat-trow-when">now</span></button>` +
    `<div class="dropdown dropdown-end chat-trow-menu"><div tabindex="0" role="button" class="btn btn-sm btn-ghost btn-square chat-trow-kebab" aria-label="Thread actions"><span class="iconify lucide--ellipsis size-4" aria-hidden="true"></span></div>` +
    `<ul tabindex="0" class="dropdown-content menu chat-kebab-menu"><li><button type="button" data-chat-rename="${esc(id)}"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span>Rename</button></li><li><button type="button" data-chat-archive="${esc(id)}"><span class="iconify lucide--archive size-3.5" aria-hidden="true"></span>Archive</button></li></ul></div>`;

  // ── new chat ──
  let newSeq = 0;
  const newChat = () => {
    if (!threadsWrap) return;
    const id = `t-new-${++newSeq}`;
    scopeByThread[id] = [];
    // rail row
    const row = document.createElement('div');
    row.className = 'chat-trow';
    row.dataset.chatTrow = id;
    row.innerHTML = railRowInner(id, 'New chat');
    threadsWrap.prepend(row);
    // conversation panel
    const empty = root.querySelector<HTMLElement>('[data-chat-empty]');
    if (empty) empty.remove(); // leaving the empty state
    const composerWrap = root.querySelector<HTMLElement>('.chat-composer-wrap');
    if (!composerWrap) { location.reload(); return; } // gated/empty had no composer; reload to render it
    const p = document.createElement('div');
    p.className = 'chat-thread';
    p.dataset.chatThread = id;
    p.innerHTML = '<div class="chat-convo" data-chat-convo><div class="chat-greet"><span class="chat-greet-ic"><span class="iconify lucide--sparkles size-7" aria-hidden="true"></span></span><p class="chat-greet-title">Ask anything about your schema</p><p class="chat-greet-sub">Scope the context to a base or table to keep answers focused.</p></div></div>';
    composerWrap.before(p);
    selectThread(id);
    root.querySelector<HTMLTextAreaElement>('[data-chat-input]')?.focus();
  };
  root.querySelectorAll<HTMLElement>('[data-chat-new]').forEach((b) => b.addEventListener('click', newChat));

  // ── context: add (browsable picker) / remove ──
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const ent = t.closest<HTMLElement>('[data-chat-add-ent]');
    if (ent) {
      const id = ent.dataset.chatAddEnt!;
      const scope = (scopeByThread[activeId] ||= []);
      if (!scope.some((r) => r.kind === 'entity' && r.id === id)) scope.push({ kind: 'entity', id, name: ent.dataset.entName || id, entityKind: ent.dataset.entKind, fieldType: ent.dataset.entFtype || undefined });
      renderContext();
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    const doc = t.closest<HTMLElement>('[data-chat-add-doc]');
    if (doc) {
      const id = doc.dataset.chatAddDoc!;
      const scope = (scopeByThread[activeId] ||= []);
      if (!scope.some((r) => r.kind === 'doc' && r.id === id)) scope.push({ kind: 'doc', id, name: doc.dataset.docTitle || 'Doc' });
      renderContext();
      (document.activeElement as HTMLElement | null)?.blur();
    }
  });
  // add-context picker search — filter items + hide empty section headers
  const ctxSearch = root.querySelector<HTMLInputElement>('[data-chat-ctx-search]');
  const ctxEmpty = root.querySelector<HTMLElement>('[data-ctx-empty]');
  ctxSearch?.addEventListener('input', () => {
    const q = ctxSearch.value.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll<HTMLElement>('.chat-addctx-item').forEach((it) => {
      const ok = !q || (it.dataset.search || '').includes(q);
      it.hidden = !ok;
      if (ok) shown++;
    });
    root.querySelectorAll<HTMLElement>('[data-ctx-sec]').forEach((sec) => {
      let any = false;
      let n = sec.nextElementSibling as HTMLElement | null;
      while (n && !n.hasAttribute('data-ctx-sec') && !n.hasAttribute('data-ctx-empty')) {
        if (n.classList.contains('chat-addctx-item') && !n.hidden) { any = true; break; }
        n = n.nextElementSibling as HTMLElement | null;
      }
      sec.hidden = !any;
    });
    if (ctxEmpty) ctxEmpty.hidden = shown > 0;
  });
  ctxChips?.addEventListener('click', (ev) => {
    const x = (ev.target as HTMLElement).closest<HTMLElement>('[data-chip-remove]');
    if (!x) return;
    const chip = x.closest<HTMLElement>('[data-chat-chip]');
    const id = chip?.dataset.refId;
    const kind = chip?.dataset.refKind;
    const scope = scopeByThread[activeId] || [];
    scopeByThread[activeId] = scope.filter((r) => !(r.id === id && r.kind === kind));
    renderContext();
  });

  // ── doc reference chips → switch to the Docs tab + open the doc ──
  root.addEventListener('click', (ev) => {
    const d = (ev.target as HTMLElement).closest<HTMLElement>('[data-doc-open]');
    if (!d) return;
    ev.preventDefault();
    document.querySelector<HTMLElement>('[data-tab="docs"]')?.click();
    document.dispatchEvent(new CustomEvent('schema:openDoc', { detail: { id: d.dataset.docOpen } }));
  });
  // (entity chips use data-entity-open → handled by the global EntityPanel delegate.)

  // ── composer: send (canned streamed reply) + convert to doc ──
  const input = root.querySelector<HTMLTextAreaElement>('[data-chat-input]');
  const sendBtn = root.querySelector<HTMLElement>('[data-chat-send]');
  const stopBtn = root.querySelector<HTMLElement>('[data-chat-stop]');
  const syncSend = () => { if (sendBtn) (sendBtn as HTMLButtonElement).disabled = !input?.value.trim(); };
  input?.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 192) + 'px'; syncSend(); });
  input?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); } });

  let streamTimer: number | undefined;
  const send = () => {
    const text = input?.value.trim();
    if (!text) return;
    const c = convo();
    if (!c) return;
    c.querySelector('.chat-greet')?.remove();
    c.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-user" data-chat-msg><span class="chat-msg-who">You</span><div class="chat-msg-body">${esc(text)}</div></div>`);
    if (input) { input.value = ''; input.style.height = 'auto'; }
    syncSend();
    scrollDown();
    // streaming status — a quiet "thinking" line with the coral marker
    const status = document.createElement('div');
    status.className = 'chat-msg chat-msg-assistant chat-streaming';
    status.innerHTML = '<span class="chat-msg-mark"><span class="iconify lucide--sparkles size-3.5" aria-hidden="true"></span></span><div class="chat-status"><span class="chat-status-dot" aria-hidden="true"></span>Reading schema…</div>';
    c.appendChild(status);
    if (sendBtn) sendBtn.hidden = true;
    if (stopBtn) stopBtn.hidden = false;
    scrollDown();
    const finish = () => {
      status.remove();
      // canned reply referencing the thread's scope (or a default note)
      const scope = scopeByThread[activeId] || [];
      const refs = scope.slice(0, 2);
      const refsHtml = refs.length
        ? `<div class="chat-msg-refs"><span class="chat-msg-refs-label">References</span>${refs.map((r) => chipHtml(r)).join('')}</div>`
        : '';
      const reply = scope.length
        ? `Based on the ${scope.length === 1 ? 'item' : 'items'} in context, here's what stands out. The linked fields look consistent, and I don't see broken references in this slice. Want me to draft a doc summarizing it?`
        : `I looked across the whole Space. Scope the context to a base or table for a more focused answer, or ask about a specific relationship. Want me to list undocumented fields?`;
      c.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-assistant" data-chat-msg><span class="chat-msg-who">Assistant</span><div class="chat-msg-body">${esc(reply)}</div>${refsHtml}${msgActions}</div>`);
      if (sendBtn) sendBtn.hidden = false;
      if (stopBtn) stopBtn.hidden = true;
      scrollDown();
    };
    streamTimer = window.setTimeout(finish, 1100);
  };
  sendBtn?.addEventListener('click', send);
  stopBtn?.addEventListener('click', () => {
    if (streamTimer) clearTimeout(streamTimer);
    root.querySelector('.chat-streaming')?.remove();
    if (sendBtn) sendBtn.hidden = false;
    if (stopBtn) stopBtn.hidden = true;
  });

  // Convert to doc — a naming popover (like Schema "Add to doc"): pre-fill a name,
  // confirm/edit, then the linked card appears in the chat.
  let docSeq = 0;
  const convertTrigger = root.querySelector<HTMLElement>('[data-chat-convert]');
  const convertName = root.querySelector<HTMLInputElement>('[data-chat-convert-name]');
  const defaultDocName = () => topbarTitle?.textContent?.trim() || 'Schema chat summary';
  // pre-fill + select the suggested name when the popover opens
  convertTrigger?.addEventListener('mousedown', () => {
    if (!convertName) return;
    convertName.value = defaultDocName();
    setTimeout(() => { convertName.focus(); convertName.select(); }, 0);
  });
  const createDoc = () => {
    const c = convo();
    if (!c) return;
    const id = `doc-chat-${++docSeq}`;
    const title = (convertName?.value || '').trim() || defaultDocName();
    c.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-msg-system" data-chat-msg><div class="chat-doccard"><span class="chat-doccard-ic"><span class="iconify lucide--file-plus-2 size-4" aria-hidden="true"></span></span><span class="chat-doccard-meta"><span class="chat-doccard-label">Saved as a doc</span><span class="chat-doccard-title">${esc(title)}</span></span><button type="button" class="btn btn-sm btn-neutral gap-1.5 chat-doccard-open" data-doc-open="${esc(id)}">Open<span class="iconify lucide--arrow-up-right size-3.5" aria-hidden="true"></span></button></div></div>`);
    (document.activeElement as HTMLElement | null)?.blur(); // close the popover
    scrollDown();
  };
  root.querySelector<HTMLElement>('[data-chat-convert-create]')?.addEventListener('click', createDoc);
  convertName?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); createDoc(); } });
  root.querySelector<HTMLElement>('[data-chat-convert-cancel]')?.addEventListener('click', () => (document.activeElement as HTMLElement | null)?.blur());

  // ── sidebar collapse (toggle in the top bar; same pattern as the Docs list collapse) ──
  root.querySelector<HTMLElement>('[data-chat-collapse]')?.addEventListener('click', () => {
    const collapsed = root.classList.toggle('is-rail-collapsed');
    const ic = root.querySelector<HTMLElement>('[data-chat-collapse-ic]');
    if (ic) ic.className = `iconify size-4 ${collapsed ? 'lucide--panel-left-open' : 'lucide--panel-left-close'}`;
  });

  // ── scroll-to-latest chip ──
  const scrollBtn = root.querySelector<HTMLElement>('[data-chat-scrollbtn]');
  scrollBtn?.addEventListener('click', () => scrollDown());
  const wireConvoScroll = (c: HTMLElement) => { if (c.dataset.scrollWired) return; c.dataset.scrollWired = '1'; c.addEventListener('scroll', syncScrollBtn); };
  root.querySelectorAll<HTMLElement>('[data-chat-convo]').forEach(wireConvoScroll);

  // ── copy an assistant message ──
  root.addEventListener('click', (ev) => {
    const cp = (ev.target as HTMLElement).closest<HTMLElement>('[data-chat-copy]');
    if (!cp) return;
    const body = cp.closest('.chat-msg')?.querySelector('.chat-msg-body')?.textContent || '';
    navigator.clipboard?.writeText(body).catch(() => {});
  });

  renderContext();
  syncSend();
  syncScrollBtn();

  function syncScrollBtn() {
    const c = convo();
    if (!c || !scrollBtn) return;
    scrollBtn.hidden = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
  }
}
