/**
 * Promptfoo Custom Provider for bythanh.com chatbot
 *
 * Reuses ChatbotPage (POM) to interact with the bot.
 * Simulates the fixture pattern via a `withChatbot` wrapper.
 *
 * Run: npm run eval
 */

import { chromium, Browser } from '@playwright/test'
import { ChatbotPage } from '../pages/ChatbotPage'

const BASE_URL = 'https://bythanh.com'
const BOT_TIMEOUT_MS = 120_000

// ─── Browser singleton ────────────────────────────────────────────────────────
// Reuse one browser across all concurrent test cases.
// Using a promise singleton avoids race conditions when maxConcurrency > 1:
// multiple callApi() calls hitting this simultaneously all await the same promise.

let browserPromise: Promise<Browser> | null = null

async function getSharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null   // reset so next call retries
      throw err
    })
  }
  return browserPromise
}

async function withChatbot<T>(fn: (chatbot: ChatbotPage) => Promise<T>): Promise<T> {
  const browser = await getSharedBrowser()
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()
  try {
    const chatbot = new ChatbotPage(page)
    await chatbot.open()
    await chatbot.openChat()
    return await fn(chatbot)
  } finally {
    await context.close()   // close context (tab), keep browser alive
  }
}

// ─── Promptfoo Provider Interface ─────────────────────────────────────────────

export default class BythanhChatbotProvider {
  id() {
    return 'bythanh-chatbot-playwright'
  }

  async callApi(prompt: string) {
    try {
      const result = await withChatbot(async (chatbot) => {
        await chatbot.sendMessage(prompt)
        const { responded, elapsedMs, text } = await chatbot.waitForBotResponse(BOT_TIMEOUT_MS)

        if (!responded) {
          return {
            error: `Bot did not respond within ${BOT_TIMEOUT_MS / 1000}s`,
            tokenUsage: {},
          }
        }

        return {
          output: text,
          tokenUsage: {},
          metadata: {
            latencyMs: elapsedMs,
            url: BASE_URL,
          },
        }
      })

      return result
    } catch (err: unknown) {
      return {
        error: `Provider error: ${err instanceof Error ? err.message : String(err)}`,
        tokenUsage: {},
      }
    }
  }
}
