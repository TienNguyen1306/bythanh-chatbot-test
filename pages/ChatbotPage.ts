import { Page, Locator } from '@playwright/test'

export class ChatbotPage {
  readonly page: Page

  // Selectors — update if website changes
  private readonly chatTriggerSel = 'button:has-text("Chat"), a:has-text("Chat now"), [class*="chat-trigger"], [class*="chatbot-trigger"]'
  private readonly inputSel       = 'input[type="text"], textarea, [contenteditable="true"], [placeholder*="message" i], [placeholder*="chat" i], [placeholder*="ask" i], [placeholder*="type" i]'
  private readonly sendBtnSel     = 'button[type="submit"], button:has-text("Send"), button:has-text("Gửi"), [aria-label*="send" i]'
  private readonly messageSel     = '[class*="message"], [class*="chat-message"], [class*="bubble"], [class*="bot-response"], [class*="response"]'
  private readonly botMessageSel  = '[class*="bot"], [class*="assistant"], [class*="ai-message"], [data-role="assistant"]'

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
    const trigger = this.page.locator(this.chatTriggerSel).first()
    if (await trigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await trigger.click()
      await this.page.waitForTimeout(1_000)
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
      await send.click()
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
    const countBefore = await this.page.locator(this.messageSel).count()

    try {
      await this.page.waitForFunction(
        ({ sel, prevCount }: { sel: string; prevCount: number }) => {
          const msgs = document.querySelectorAll(sel)
          return msgs.length > prevCount
        },
        { sel: this.messageSel, prevCount: countBefore },
        { timeout: timeoutMs }
      )

      const elapsedMs = Date.now() - start
      const text = await this.getLastBotMessage()
      return { responded: true, elapsedMs, text }
    } catch {
      return { responded: false, elapsedMs: Date.now() - start, text: '' }
    }
  }

  async getLastBotMessage(): Promise<string> {
    const messages = this.page.locator(this.messageSel)
    const count = await messages.count()
    if (count === 0) return ''
    return (await messages.last().innerText()).trim()
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
    return this.page.locator(this.inputSel).first().isVisible({ timeout: 5_000 }).catch(() => false)
  }

  async isSendButtonDisabled(): Promise<boolean> {
    const btn = await this.getSendButton()
    const disabled = await btn.getAttribute('disabled')
    const ariaDisabled = await btn.getAttribute('aria-disabled')
    return disabled !== null || ariaDisabled === 'true'
  }

  async getInputValue(): Promise<string> {
    const input = await this.getInputField()
    return input.inputValue().catch(() => '')
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
