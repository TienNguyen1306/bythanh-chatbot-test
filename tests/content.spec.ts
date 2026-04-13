/**
 * Content Test Cases: TC-04 to TC-10, TC-15
 * Focus: Bot response quality — requires bot to be working.
 * Uses: ChatbotPage (POM) via Playwright fixture + data-driven from testData.ts
 */

import { test, expect } from '../fixtures/chatbot.fixture'
import { CONTENT_TEST_CASES } from '../data/testData'

const BOT_TIMEOUT_MS = 60_000

// ─── Data-driven: TC-04 to TC-10 (single-turn) ───────────────────────────────

const singleTurnCases = CONTENT_TEST_CASES.filter(tc => !tc.followUp)

for (const tc of singleTurnCases) {
  test(`[${tc.id}] ${tc.description}`, async ({ chatbot }) => {
    await chatbot.sendMessage(tc.question)

    const { responded, elapsedMs, text } = await chatbot.waitForBotResponse(BOT_TIMEOUT_MS)

    // ── Must respond ────────────────────────────────────────────────────────
    expect(
      responded,
      `Bot did not respond within ${BOT_TIMEOUT_MS / 1000}s for question: "${tc.question}"`
    ).toBe(true)

    // ── TC-04 specific: response time < 30s ────────────────────────────────
    if (tc.id === 'TC-04') {
      expect(
        elapsedMs,
        `Expected response in under 30s but got ${(elapsedMs / 1000).toFixed(1)}s`
      ).toBeLessThan(30_000)
    }

    // ── Keyword check ───────────────────────────────────────────────────────
    if (tc.shouldContainAny && tc.shouldContainAny.length > 0) {
      const lowerText = text.toLowerCase()
      const matched = tc.shouldContainAny.some(k => lowerText.includes(k.toLowerCase()))
      expect(
        matched,
        `Response should contain at least one of: [${tc.shouldContainAny.join(', ')}]\nActual response: "${text}"`
      ).toBe(true)
    }

    // ── Negative keyword check ──────────────────────────────────────────────
    if (tc.shouldNotContain && tc.shouldNotContain.length > 0) {
      for (const forbidden of tc.shouldNotContain) {
        expect(
          text.toLowerCase(),
          `Response must NOT contain "${forbidden}" (privacy/accuracy violation)\nActual: "${text}"`
        ).not.toContain(forbidden.toLowerCase())
      }
    }
  })
}

// ─── TC-15: Multi-turn conversation ──────────────────────────────────────────

const tc15 = CONTENT_TEST_CASES.find(tc => tc.id === 'TC-15')!

test(`[${tc15.id}] ${tc15.description}`, async ({ chatbot }) => {
  // Turn 1
  await chatbot.sendMessage(tc15.question)
  const turn1 = await chatbot.waitForBotResponse(BOT_TIMEOUT_MS)

  expect(
    turn1.responded,
    `Turn 1: Bot did not respond within ${BOT_TIMEOUT_MS / 1000}s`
  ).toBe(true)

  if (tc15.shouldContainAny) {
    const matched = tc15.shouldContainAny.some(k =>
      turn1.text.toLowerCase().includes(k.toLowerCase())
    )
    expect(
      matched,
      `Turn 1 response should contain at least one of: [${tc15.shouldContainAny.join(', ')}]\nActual: "${turn1.text}"`
    ).toBe(true)
  }

  // Turn 2: follow-up
  await chatbot.sendMessage(tc15.followUp!)
  const turn2 = await chatbot.waitForBotResponse(BOT_TIMEOUT_MS)

  expect(
    turn2.responded,
    'Turn 2: Bot did not respond to follow-up question'
  ).toBe(true)

  // Follow-up should add new info, not repeat verbatim
  expect(
    turn2.text,
    'Follow-up response should not be identical to first response'
  ).not.toBe(turn1.text)

  // Should still be about Thanh (context maintained)
  expect(
    turn2.text.toLowerCase(),
    'Follow-up should still reference Thanh or his career'
  ).toMatch(/thanh|career|work|professional|experience|role/i)
})
