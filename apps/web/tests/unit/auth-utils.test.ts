// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  showFormError,
  hideFormError,
  showFormSuccess,
  hideFormSuccess,
} from '../../src/lib/auth-utils'

describe('auth-utils', () => {
  let errorEl: HTMLElement
  let textEl: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="err" class="hidden">
        <span id="msg"></span>
      </div>
    `
    errorEl = document.getElementById('err') as HTMLElement
    textEl = document.getElementById('msg') as HTMLElement
  })

  describe('showFormError', () => {
    it('removes the hidden class and writes the message text', () => {
      showFormError(errorEl, textEl, 'Email is required.')
      expect(errorEl.classList.contains('hidden')).toBe(false)
      expect(textEl.textContent).toBe('Email is required.')
    })

    it('overwrites a previously shown message', () => {
      showFormError(errorEl, textEl, 'first')
      showFormError(errorEl, textEl, 'second')
      expect(textEl.textContent).toBe('second')
    })
  })

  describe('hideFormError', () => {
    it('adds the hidden class', () => {
      errorEl.classList.remove('hidden')
      hideFormError(errorEl)
      expect(errorEl.classList.contains('hidden')).toBe(true)
    })

    it('is idempotent when already hidden', () => {
      hideFormError(errorEl)
      hideFormError(errorEl)
      expect(errorEl.classList.contains('hidden')).toBe(true)
    })
  })

  describe('showFormSuccess / hideFormSuccess', () => {
    it('mirrors the error helpers', () => {
      showFormSuccess(errorEl, textEl, 'Saved.')
      expect(errorEl.classList.contains('hidden')).toBe(false)
      expect(textEl.textContent).toBe('Saved.')

      hideFormSuccess(errorEl)
      expect(errorEl.classList.contains('hidden')).toBe(true)
    })
  })
})
