// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  $spaces,
  hydrateSpacesFromDom,
  refreshSpaces,
  type SpacesState,
} from '../../../src/stores/spaces'

const SAMPLE: SpacesState = {
  list: [
    { id: 's1', name: 'Acme', status: 'active' },
    { id: 's2', name: 'Beta', status: 'setup_incomplete' },
  ],
  activeSpaceId: 's1',
}

describe('$spaces store', () => {
  beforeEach(() => {
    $spaces.set(null)
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('hydrateSpacesFromDom', () => {
    it('parses #spaces-state JSON and sets the atom', () => {
      const script = document.createElement('script')
      script.id = 'spaces-state'
      script.type = 'application/json'
      script.textContent = JSON.stringify(SAMPLE)
      document.body.appendChild(script)

      hydrateSpacesFromDom()

      expect($spaces.get()).toEqual(SAMPLE)
    })

    it('returns cleanly when #spaces-state is missing', () => {
      hydrateSpacesFromDom()
      expect($spaces.get()).toBeNull()
    })

    it('leaves the atom unchanged when JSON is malformed', () => {
      const script = document.createElement('script')
      script.id = 'spaces-state'
      script.textContent = '{not-json'
      document.body.appendChild(script)

      $spaces.set(SAMPLE)
      hydrateSpacesFromDom()
      expect($spaces.get()).toEqual(SAMPLE)
    })
  })

  describe('refreshSpaces', () => {
    it('updates the atom from a successful /api/spaces fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            spaces: SAMPLE.list,
            activeSpaceId: SAMPLE.activeSpaceId,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      vi.stubGlobal('fetch', fetchMock)

      await refreshSpaces()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/spaces',
        expect.objectContaining({ method: 'GET' }),
      )
      expect($spaces.get()).toEqual(SAMPLE)
    })

    it('does not mutate the atom on a failed fetch', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('nope', { status: 500 })),
      )
      $spaces.set(SAMPLE)

      await refreshSpaces()

      expect($spaces.get()).toEqual(SAMPLE)
    })
  })
})
