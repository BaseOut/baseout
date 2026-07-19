// MV3 service worker: watches the active tab and broadcasts parsed Airtable
// context to the side panel. Stateless per event — worker restarts are
// harmless (embed change, design Decision 3).
import { parseAirtableUrl } from './parse-airtable-url.js'

export const CONTEXT_MESSAGE = 'bo-embed:context'
export const CONTEXT_REQUEST = 'bo-embed:context-request'

async function activeTabUrl(): Promise<string | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab?.url
}

async function broadcastContext(): Promise<void> {
  const context = parseAirtableUrl(await activeTabUrl())
  // No listener (panel closed) rejects — expected, swallow.
  await chrome.runtime.sendMessage({ type: CONTEXT_MESSAGE, context }).catch(() => {})
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

chrome.tabs.onActivated.addListener(() => void broadcastContext())
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') void broadcastContext()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as { type?: string })?.type === CONTEXT_REQUEST) {
    void activeTabUrl().then((url) => sendResponse({ context: parseAirtableUrl(url) }))
    return true // async sendResponse
  }
  return false
})
