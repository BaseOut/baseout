import { $spaces } from '../../stores/spaces';

export interface HandleSpaceSwitchDeps {
  fetchImpl?: typeof fetch;
  navigate?: (href: string) => unknown | Promise<unknown>;
  getUrl?: () => { pathname: string; search: string };
}

export async function handleSpaceSwitch(
  btn: HTMLButtonElement,
  deps: HandleSpaceSwitchDeps = {},
): Promise<void> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getUrl =
    deps.getUrl ??
    (() => ({
      pathname: window.location.pathname,
      search: window.location.search,
    }));

  const spaceId = btn.dataset.spaceId;
  if (!spaceId || btn.disabled) return;
  const prev = $spaces.get();
  if (!prev || prev.activeSpaceId === spaceId) return;

  btn.disabled = true;
  const res = await fetchImpl('/api/spaces/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spaceId }),
  });
  if (!res.ok) {
    btn.disabled = false;
    return;
  }
  $spaces.set({ ...prev, activeSpaceId: spaceId });
  (document.activeElement as HTMLElement | null)?.blur();

  const main = document.querySelector<HTMLElement>('main#layout-content');
  if (main?.dataset.spaceScoped === 'true' && deps.navigate) {
    const { pathname, search } = getUrl();
    await deps.navigate(pathname + search);
  }
}
