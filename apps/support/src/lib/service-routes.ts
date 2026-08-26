/**
 * Which paths are SERVICE pages rather than documentation — held once.
 *
 * WHY IT EXISTS. A service page is rendered through `StarlightPage`, so every test Starlight and this
 * portal apply to "a docs page" answers yes for it. Three separate places therefore have to be told
 * otherwise, and until 2026-08-21 each kept its own hand-written list: the chrome suppression in
 * `styles/support.css` (hide the docs tree, close the sidebar gutter, reclaim the menu-button
 * padding), the header's `isCurrent` (or `Documentation` lights up while the reader is on the
 * contact form), and `DocsFooter` (or a service page asks whether the documentation was helpful).
 *
 * `/requests/` and `/requests/<ref>/` arrived wearing all three, which is what forced this file. Two
 * of the three now read from here. **The CSS list cannot** — a stylesheet has no imports — so
 * `support.css` still names `.rq` and `.tk` by hand, and that duplication is deliberate and marked
 * at both ends rather than pretended away.
 *
 * ADD A SERVICE PAGE, ADD IT HERE AND IN `support.css`. Two places, both commented. That is the
 * standing cost of a mechanism that cannot know about a page nobody told it about.
 */
export const SERVICE_PREFIXES = ['/contact', '/roadmap', '/requests'] as const;

export const isServicePath = (pathname: string): boolean =>
  SERVICE_PREFIXES.some((p) => pathname.startsWith(p));
