import { Page, Locator } from '@playwright/test'

export class ChatbotPage {
  readonly page: Page

  // Selectors — update if website changes
  private readonly chatTriggerSel = '#robotContainer, [class*="robot_robotContainer"], [class*="chat-trigger"], [class*="chatbot-trigger"], button:has-text("Chat"), a:has-text("Chat now")'
  private readonly inputSel       = 'input[class*="chat_input"], input[type="text"], textarea, [contenteditable="true"], [placeholder*="message" i], [placeholder*="chat" i], [placeholder*="ask" i], [placeholder*="type" i]'
  private readonly sendBtnSel     = '[class*="chat_button"], button[type="submit"], button:has-text("Send"), button:has-text("Gửi"), [aria-label*="send" i]'
  private readonly messageSel     = '[class*="assistantMessage"], [class*="chat_messages"] > div, [class*="message"], [class*="bubble"]'
  private readonly botMessageSel  = '[class*="assistantMessage"]'

  constructor(page: Page) {
    this.page = page
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  async open() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  // ─── Chat Interaction ──────────────────────────────────────────────────────

  async openChat(): Promise<boolean> {
    // Check if chat input is already visible (chatbot embedded and auto-opened)
    const input = this.page.locator(this.inputSel).first()
    const alreadyOpen = await input.isVisible({ timeout: 3_000 }).catch(() => false)
    if (alreadyOpen) return true

    // Try clicking the chat trigger to open the panel
    const trigger = this.page.locator(this.chatTriggerSel).first()
    if (await trigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await trigger.click()
      // Wait for the chat input to appear (chat panel opened)
      await input.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
      return true
    }
    return false   // chatbot may already be open
  }

  async getInputField(): Promise<Locator> {
    return this.page.locator(this.inputSel).first()
  }

  async getSendButton(): Promise<Locator> {
    return this.page.locator(this.sendBtnSel).first()
  }

  async typeMessage(message: string) {
    const input = await this.getInputField()
    await input.waitFor({ state: 'visible', timeout: 10_000 })
    await input.fill(message)
  }

  async sendMessage(message: string) {
    await this.typeMessage(message)
    const send = await this.getSendButton()
    const sendVisible = await send.isVisible({ timeout: 3_000 }).catch(() => false)
    if (sendVisible) {
      await send.click({ force: true }).catch(() => this.page.keyboard.press('Enter'))
    } else {
      await this.page.keyboard.press('Enter')
    }
  }

  async pressEnterToSend(message: string) {
    await this.typeMessage(message)
    await this.page.keyboard.press('Enter')
  }

  // ─── Response Handling ─────────────────────────────────────────────────────

  /**
   * Wait for a bot response to appear.
   * Returns { responded: boolean, elapsedMs: number, text: string }
   */
  async waitForBotResponse(timeoutMs = 60_000): Promise<{ responded: boolean; elapsedMs: number; text: string }> {
    const start = Date.now()
    const countBefore = await this.page.locator(this.botMessageSel).count()
    // Snapshot full body text as baseline so we can extract only what the bot added
    const textBefore = await this.page.evaluate(() => document.body.innerText)

    try {
      // Wait until a new assistant message appears OR significant text growth
      await this.page.waitForFunction(
        ({ botSel, prevCount, prevLen }: { botSel: string; prevCount: number; prevLen: number }) => {
          const msgs = document.querySelectorAll(botSel)
          const newElementDetected = msgs.length > prevCount
          // Fallback: detect bot response via significant page text growth (>50 chars)
          const textGrown = document.body.innerText.length > prevLen + 50
          return newElementDetected || textGrown
        },
        { botSel: this.botMessageSel, prevCount: countBefore, prevLen: textBefore.length },
        { timeout: timeoutMs }
      )

      // Wait for the "waiting/typing" indicator to disappear (bot finished generating)
      const remainingMs = Math.max(timeoutMs - (Date.now() - start), 10_000)
      await this.page.locator('#waitingMessage, [class*="waitingMessage"]').waitFor({ state: 'hidden', timeout: remainingMs }).catch(() => {})

      // Wait for response text to stabilize (not just dots / still streaming)
      const stabilizeDeadline = Date.now() + remainingMs
      let stableText = ''
      let previousText = ''
      let stableCount = 0
      while (Date.now() < stabilizeDeadline) {
        const current = await this.getLastBotMessage()
        const isOnlyDots = /^\.+$/.test(current.trim())
        if (!isOnlyDots && current === previousText && current.trim().length > 0) {
          stableCount++
          if (stableCount >= 2) { stableText = current; break }
        } else {
          stableCount = 0
        }
        previousText = current
        await this.page.waitForTimeout(500)
      }

      const elapsedMs = Date.now() - start

      // Try specific bot message selector first (most accurate)
      let text = stableText || await this.getLastBotMessage()

      // Fallback: extract only the NEW portion of page text
      if (!text) {
        const textAfter = await this.page.evaluate(() => document.body.innerText)
        text = textAfter.slice(textBefore.length).trim()
      }

      return { responded: true, elapsedMs, text }
    } catch {
      return { responded: false, elapsedMs: Date.now() - start, text: '' }
    }
  }

  async getLastBotMessage(): Promise<string> {
    // Use the specific bot/assistant message selector, excluding the waiting/typing indicator
    const botMessages = this.page.locator(`${this.botMessageSel}:not(#waitingMessage):not([class*="waitingMessage"])`)
    const botCount = await botMessages.count()
    if (botCount > 0) {
      return (await botMessages.last().innerText()).trim()
    }

    return ''
  }

  async getAllMessages(): Promise<string[]> {
    const messages = this.page.locator(this.messageSel)
    const count = await messages.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      texts.push((await messages.nth(i).innerText()).trim())
    }
    return texts
  }

  async getMessageCount(): Promise<number> {
    return this.page.locator(this.messageSel).count()
  }

  // ─── State Checks ──────────────────────────────────────────────────────────

  async isInputVisible(): Promise<boolean> {
    return this.page.locator(this.inputSel).first().isVisible({ timeout: 10000 }).catch(() => false)
  }

  async isSendButtonDisabled(): Promise<boolean> {
    const btn = await this.getSendButton()
    const disabled = await btn.getAttribute('disabled')
    const ariaDisabled = await btn.getAttribute('aria-disabled')
    return disabled !== null || ariaDisabled === 'true'
  }

  async getInputValue(): Promise<string> {
    const input = await this.getInputField()
    // inputValue() works for <input>/<textarea>; contenteditable needs innerText()
    return input.inputValue().catch(async () => {
      return (await input.innerText().catch(() => '')).trim()
    })
  }

  async hasGreeting(): Promise<boolean> {
    await this.page.waitForTimeout(2_000)
    const count = await this.getMessageCount()
    return count > 0
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  async screenshot(path: string) {
    await this.page.screenshot({ path, fullPage: true })
  }

  async getFullPageText(): Promise<string> {
    return this.page.evaluate(() => document.body.innerText)
  }
}
