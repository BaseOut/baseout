// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $spaces } from '../../stores/spaces';
import { handleSpaceSwitch } from './space-switch';

const SPACE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SPACE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function seedDom(spaceScoped: 'true' | 'false' | null) {
  const mainAttr =
    spaceScoped === null ? '' : ` data-space-scoped="${spaceScoped}"`;
  document.body.innerHTML = `
    <main id="layout-content"${mainAttr}>
      <button type="button" data-space-switch data-space-id="${SPACE_B}">Switch</button>
    </main>
  `;
  return document.querySelector<HTMLButtonElement>(
    'button[data-space-switch]',
  )!;
}

beforeEach(() => {
  $spaces.set({
    list: [
      { id: SPACE_A, name: 'Alpha', status: 'active' },
      { id: SPACE_B, name: 'Bravo', status: 'active' },
    ],
    activeSpaceId: SPACE_A,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  $spaces.set(null);
});

describe('handleSpaceSwitch', () => {
  it('navigates same-URL when fetch succeeds and main is space-scoped', async () => {
    const btn = seedDom('true');
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 200 }),
    ) as unknown as typeof fetch;
    const navigate = vi.fn(async () => {});

    await handleSpaceSwitch(btn, {
      fetchImpl,
      navigate,
      getUrl: () => ({ pathname: '/backups', search: '?q=foo' }),
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(call[0]).toBe('/api/spaces/switch');
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body as string)).toEqual({ spaceId: SPACE_B });

    expect($spaces.get()?.activeSpaceId).toBe(SPACE_B);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/backups?q=foo');
  });

  it('skips navigation when main is not space-scoped (attribute = "false")', async () => {
    const btn = seedDom('false');
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 200 }),
    ) as unknown as typeof fetch;
    const navigate = vi.fn(async () => {});

    await handleSpaceSwitch(btn, {
      fetchImpl,
      navigate,
      getUrl: () => ({ pathname: '/settings', search: '' }),
    });

    expect($spaces.get()?.activeSpaceId).toBe(SPACE_B);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('skips navigation when the data-space-scoped attribute is missing', async () => {
    const btn = seedDom(null);
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 200 }),
    ) as unknown as typeof fetch;
    const navigate = vi.fn(async () => {});

    await handleSpaceSwitch(btn, {
      fetchImpl,
      navigate,
      getUrl: () => ({ pathname: '/', search: '' }),
    });

    expect($spaces.get()?.activeSpaceId).toBe(SPACE_B);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate or mutate the store when fetch returns non-ok and re-enables the button', async () => {
    const btn = seedDom('true');
    const fetchImpl = vi.fn(
      async () => new Response('{"error":"nope"}', { status: 403 }),
    ) as unknown as typeof fetch;
    const navigate = vi.fn(async () => {});

    await handleSpaceSwitch(btn, {
      fetchImpl,
      navigate,
      getUrl: () => ({ pathname: '/backups', search: '' }),
    });

    expect($spaces.get()?.activeSpaceId).toBe(SPACE_A);
    expect(navigate).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('is a no-op when the button is already disabled', async () => {
    const btn = seedDom('true');
    btn.disabled = true;
    const fetchImpl = vi.fn();
    const navigate = vi.fn();

    await handleSpaceSwitch(btn, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      navigate,
      getUrl: () => ({ pathname: '/backups', search: '' }),
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('is a no-op when the target space is already active', async () => {
    const btn = seedDom('true');
    btn.dataset.spaceId = SPACE_A; // current active
    const fetchImpl = vi.fn();
    const navigate = vi.fn();

    await handleSpaceSwitch(btn, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      navigate,
      getUrl: () => ({ pathname: '/backups', search: '' }),
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('disables the button while fetch is in flight', async () => {
    const btn = seedDom('true');
    let resolve!: (r: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((res) => {
          resolve = res;
        }),
    ) as unknown as typeof fetch;
    const navigate = vi.fn(async () => {});

    const pending = handleSpaceSwitch(btn, {
      fetchImpl,
      navigate,
      getUrl: () => ({ pathname: '/backups', search: '' }),
    });
    await Promise.resolve();
    expect(btn.disabled).toBe(true);

    resolve(new Response('{}', { status: 200 }));
    await pending;
  });
});
