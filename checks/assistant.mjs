/**
 * Drives the assistant panel in a real browser. These calls hit the Claude API
 * and cost tokens, so this is a deliberate command, not part of the build.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const posts = []
page.on('request', (r) => {
  if (r.url().includes('/api/assistant')) posts.push(JSON.parse(r.postData() || '{}'))
})

const results = []
const check = (name, pass, detail = '') => results.push({ name, pass, detail: pass ? '' : detail })
const replies = () => page.$$eval('.chat-assistant .chat-body', (els) => els.map((e) => e.innerText.trim()))
const waitForReply = (count) =>
  page.waitForFunction(
    (n) => {
      const nodes = document.querySelectorAll('.chat-assistant .chat-body')
      return nodes.length === n && nodes[n - 1].innerText.trim().length > 0
    },
    count,
    { timeout: 45000 },
  )

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.click('.page-body')
await page.keyboard.press('Meta+a')
await page.keyboard.type('The harbour wall was built in 1881 from local granite.')

await page.click('button:has-text("Assistant")')
await page.waitForSelector('.assistant', { timeout: 5000 })
check('panel opens', true)

await page.click('.assistant-chip:has-text("Summarise")')
await waitForReply(1)
await page.waitForTimeout(1500)
check('quick action sends a message', (posts[0]?.messages ?? []).length === 1, JSON.stringify(posts[0]?.messages?.length))
check('document text reaches the server', (posts[0]?.document?.text ?? '').includes('harbour wall'))

await page.fill('.assistant-field', 'What year? Reply with only the year.')
await page.click('.assistant-send')
await waitForReply(2)
await page.waitForTimeout(1500)

const roles = (posts[1]?.messages ?? []).map((m) => m.role).join(',')
check('follow-up carries the history', roles === 'user,assistant,user', `roles=${roles}`)
const second = (await replies())[1] ?? ''
check('answer comes from the document', second.includes('1881'), JSON.stringify(second.slice(0, 80)))

const before = await page.$eval('.page-body', (el) => el.innerText.length)
await page.hover('.chat-assistant:last-of-type')
await page.click('.chat-assistant:last-of-type .chat-action:has-text("Insert")')
await page.waitForTimeout(600)
const after = await page.$eval('.page-body', (el) => el.innerText.length)
check('Insert writes into the document', after > before, `${before} -> ${after}`)

await page.click('button[aria-label="New conversation"]')
await page.waitForTimeout(300)
check('new conversation clears the thread', (await page.$$('.chat')).length === 0)

await page.emulateMedia({ media: 'print' })
const panelPrinted = await page.evaluate(() => {
  const el = document.querySelector('.assistant')
  return el ? getComputedStyle(el).display !== 'none' : false
})
check('panel is hidden when printing', panelPrinted === false)

console.log()
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`)
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`)
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(results.every((r) => r.pass) ? 0 : 1)
