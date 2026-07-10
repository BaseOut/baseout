# Questions — 10 Jul 2026

Everything is built and live on `ui.baseout.dev`. I'll walk through the rest in the video — these are
the eight where I need you.

## Panels

**Q1 — You asked us to remove the ✕ from collapsed strips. We kept it and made closing undoable instead.
Right call?**
Your problem was real: on a 40px strip the ✕ sits exactly where you click to expand. But removing it
makes the strip the only thing in the app you can't close where you see it. So now **every close shows a
4-second Undo**. The accident stopped being expensive, so the button stopped being dangerous. If you
still want it gone, that's a two-minute change.

**Q2 — You asked us not to let a new panel destroy an old one. Two things happen now. Correct?**
Most of the time you weren't hitting a limit, you were hitting the edge of your monitor — so a panel
with no room **opens as a thin strip** instead of closing anything. The real ceiling is **10 panels**,
and there we **refuse** rather than evict: *"Can't add another panel — maximum of 10 reached.
[Close oldest]"*. The destructive step is still one click, but it's your click. 10 is measured: past
~10 the strips stop being individually clickable. Want 12?

**Q3 — OPEN, and we need your call: what happens to open panels when you switch Schema tabs**
(Browse → Relationships)? Today they're all destroyed silently. Keep them? Close them but offer one
grouped Undo? Keep them per tab? This is about how you work, so we didn't guess.

**Q4 — OPEN: should Automations and Interfaces rows open panels too?**
Today only Browse and Relationships do, which is inconsistent.

---

## Export

**Q5 — CSV cells starting with `=` `+` `-` `@` get an apostrophe. You didn't ask for this; we think it's
non-negotiable. Agree?**
Airtable formula fields *begin with* `=`. Exported raw, a spreadsheet **executes** them on open — a
security hole (OWASP calls it CSV Injection), and it means the formula definitions we claim to document
get evaluated instead of shown.

**Q6 — Visualize: we export the whole graph, fitted, on your current theme's background, at 2×, as PNG.
Which of those four is wrong?**
Whole graph, because exporting the viewport silently drops the off-screen nodes. Theme background — but
we're a dark product and the PNG usually lands in a white doc, so **should Light be the default?** PNG
only — **do you want SVG?** Figma and Miro offer vector for diagrams because raster blurs when zoomed.

**Q7 — PDF exports the open thread (Chat) and the open document (Docs) — not the whole history or every
doc in the Space. Correct?**

**Q8 — We deleted the JSON option from Changelog, since you said CSV is sufficient. Keep it deleted?**
Flagging: Metabase, Retool and Grafana all offer JSON/XLSX beside CSV, ProBackup defaults to Excel —
and your users are technical ops, the exact audience that asks.

---

No file actually downloads in the preview — there's no backend yet.
