/**
 * Promptfoo Custom Provider for bythanh.com chatbot
 *
 * Reuses ChatbotPage (POM) to interact with the bot.
 * Simulates the fixture pattern via a `withChatbot` wrapper.
 *
 * Run: npm run eval
 */

import { chromium } from '@playwright/test'
import { ChatbotPage } from '../pages/ChatbotPage'

const BASE_URL = 'https://bythanh.com'
const BOT_TIMEOUT_MS = 120_000

// ─── Fixture-like wrapper ──────────────────────────────────────────────────────
// Mirrors what chatbot.fixture.ts does, but for non-test context

async function withChatbot<T>(fn: (chatbot: ChatbotPage) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()
  try {
    const chatbot = new ChatbotPage(page)
    await chatbot.open()
    await chatbot.openChat()
    return await fn(chatbot)
  } finally {
    await browser.close()
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
