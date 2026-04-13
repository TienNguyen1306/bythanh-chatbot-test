# bythanh-chatbot-test

Automation test suite for [bythanh.com](https://bythanh.com) chatbot.

**Stack:** Playwright (UI + content) + Promptfoo with Gemini (LLM-as-judge)
**Pattern:** Page Object Model (POM) + Data-Driven Testing + Playwright Fixtures

---

## Project Structure

```
├── pages/
│   └── ChatbotPage.ts          # Page Object — all selectors & interactions
├── data/
│   └── testData.ts             # Test data — all 15 test cases
├── fixtures/
│   └── chatbot.fixture.ts      # Playwright fixture — initializes ChatbotPage
├── tests/
│   ├── ui.spec.ts              # TC-01~03, TC-11~14 (UI behaviour)
│   └── content.spec.ts         # TC-04~10, TC-15 (bot response quality)
├── promptfoo/
│   └── provider.ts             # Promptfoo provider — reuses ChatbotPage
├── promptfooconfig.yaml        # Promptfoo eval config with Gemini judge
└── .env.example                # Environment variables template
```

---

## Setup

```bash
npm install
npx playwright install chromium

# For LLM-as-judge eval:
cp .env.example .env
# Add your Gemini API key → https://aistudio.google.com/apikey
```

---

## Running Tests

```bash
# All Playwright tests (UI + content)
npm test

# UI tests only (no bot response needed)
npm run test:ui

# Content tests only (bot must be working)
npm run test:content

# Headed mode (see the browser)
npm run test:headed

# View HTML report
npm run test:report

# Promptfoo eval (LLM-as-judge with Gemini)
npm run eval

# View Promptfoo results in browser
npm run eval:view
```

---

## Test Cases

| ID | Description | Type | Needs bot? |
|----|-------------|------|-----------|
| TC-01 | Greeting appears on load | UI | ❌ |
| TC-02 | Input field is functional | UI | ❌ |
| TC-03 | Send button is present | UI | ❌ |
| TC-04 | Bot responds within 30s | Content + latency | ✅ |
| TC-05 | Professional background | Content | ✅ |
| TC-06 | Work history & companies | Content | ✅ |
| TC-07 | Skills & expertise | Content | ✅ |
| TC-08 | Refuses private info | Privacy | ✅ |
| TC-09 | Handles off-topic gracefully | Edge case | ✅ |
| TC-10 | Responds in Vietnamese | Language | ✅ |
| TC-11 | Empty message not sent | UI | ❌ |
| TC-12 | Long input handled | UI | ❌ |
| TC-13 | XSS injection sanitized | Security | ❌ |
| TC-14 | Enter key sends message | UI | ❌ |
| TC-15 | Multi-turn context maintained | Content | ✅ |

---

## Assertion Layers

| Layer | Tool | Needs API key? |
|-------|------|----------------|
| Keyword / regex check | Playwright + Promptfoo `javascript` | ❌ No |
| Response time (latency) | Promptfoo `latency` | ❌ No |
| Privacy / negative check | Promptfoo `not-contains` | ❌ No |
| Content quality (LLM judge) | Promptfoo `llm-rubric` via Gemini | ✅ `GOOGLE_API_KEY` |
