import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const results = []
const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail: pass ? '' : detail })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const seedCount = await page.evaluate(async () => {
  const open = indexedDB.open('porky')
  const db = await new Promise((res) => { open.onsuccess = () => res(open.result) })
  const r = db.transaction('meta').objectStore('meta').getAll()
  return new Promise((res) => { r.onsuccess = () => res(r.result.length) })
})
check('first load creates exactly one document', seedCount === 1, `found ${seedCount}`)

const body = '.page-body'
const html = () => page.$eval(body, (el) => el.innerHTML)

// ---- marks -------------------------------------------------------------
await page.click(body)
await page.keyboard.press('Meta+a')
await page.keyboard.type('Formatting target sentence.')
await page.keyboard.press('Meta+a')
await page.click('button[aria-label^="Bold"]')
await page.click('button[aria-label^="Italic"]')
await page.click('button[aria-label^="Underline"]')
await page.click('button[aria-label="Strikethrough"]')
let h = await html()
check('bold/italic/underline/strike', /<strong>/.test(h) && /<em>/.test(h) && /<u>/.test(h) && /<s>/.test(h), h.slice(0, 160))
check('bold button reflects state', await page.getAttribute('button[aria-label^="Bold"]', 'aria-pressed') === 'true')

// ---- font family + size ------------------------------------------------
await page.click('button[aria-label="Font"]')
await page.click('.tool-pop [role="menuitemradio"]:has-text("Lora")')
await page.click('button[aria-label="Font size"]')
await page.click('.tool-pop [role="menuitemradio"]:has-text("24")')
h = await html()
check('font family applied', /Lora/.test(h), h.slice(0, 200))
check('font size applied', /24pt/.test(h), h.slice(0, 200))
check('size box shows 24', (await page.$eval('button[aria-label="Font size"]', (b) => b.innerText)).includes('24'))

// ---- colour + highlight ------------------------------------------------
await page.click('button[aria-label="Text colour"]')
await page.click('.swatch[aria-label="#ff0000"]')
await page.click('button[aria-label="Highlight colour"]')
await page.click('.swatch[aria-label="#ffff00"]')
h = await html()
check('text colour applied', /ff0000|rgb\(255, 0, 0\)/.test(h), h.slice(0, 220))
check('highlight applied', /ffff00|rgb\(255, 255, 0\)/.test(h), h.slice(0, 220))

// ---- lists, indent, spacing -------------------------------------------
await page.click(body)
await page.keyboard.press('Meta+a')
await page.keyboard.press('Backspace')
await page.keyboard.type('First item')
await page.click('button[aria-label="Bulleted list"]')
await page.keyboard.press('Enter')
await page.keyboard.type('Nested item')
await page.keyboard.press('Tab')
h = await html()
check('bullet list + Tab nests', (h.match(/<ul>/g) || []).length >= 2, h.slice(0, 260))

await page.keyboard.press('Meta+a')
await page.keyboard.press('Backspace')
await page.keyboard.type('Plain paragraph for indent.')
await page.keyboard.press('Tab')
h = await html()
check('Tab indents a plain paragraph', /margin-left: 40px/.test(h), h.slice(0, 200))

await page.click('button[aria-label="Line spacing"]')
await page.click('.tool-pop [role="menuitemradio"]:has-text("2.5")')
h = await html()
check('line spacing applied', /line-height: 2\.5/.test(h), h.slice(0, 200))

// ---- link --------------------------------------------------------------
await page.keyboard.press('Meta+a')
await page.click('button[aria-label^="Link"]')
await page.fill('.link-field', 'example.com')
await page.click('.link-pop .ghost-btn:has-text("Apply")')
await page.waitForTimeout(400)  // let the popover close and focus return
h = await html()
check('link applied with https normalisation', /href="https:\/\/example\.com"/.test(h), h.slice(0, 220))

// ---- image -------------------------------------------------------------
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAPUlEQVR42u3OMQEAAAgDoC252H8sFmSwcTUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4NjMZAAFPHcnAAAAAAElFTkSuQmCC',
  'base64',
)
await page.keyboard.press('ArrowRight')
await page.keyboard.press('Enter')
await page.setInputFiles('.toolbar input[type=file]', {
  name: 'square.png', mimeType: 'image/png', buffer: png,
})
await page.waitForSelector('.img-block img', { timeout: 8000 })
check('image inserted', (await page.$$('.img-block img')).length === 1)
await page.click('.img-block img')
await page.waitForSelector('.img-bar', { timeout: 4000 })
await page.click('.img-preset[aria-label="Width 50%"]')
await page.click('button[aria-label="Align right"][aria-pressed="false"], .img-bar button[aria-label="Align right"]')
const frameWidth = await page.$eval('.img-frame', (el) => el.style.width)
const align = await page.$eval('.img-block', (el) => el.dataset.align)
check('image width preset works', frameWidth === '50%', `width=${frameWidth}`)
check('image alignment works', align === 'right', `align=${align}`)

// ---- persistence across reload ----------------------------------------
await page.waitForTimeout(1200)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.img-block img', { timeout: 8000 })
h = await html()
check('image survives reload', /<img/.test(h))
check('link survives reload', /href="https:\/\/example\.com"/.test(h), h.slice(0, 260))
const widthAfter = await page.$eval('.img-frame', (el) => el.style.width)
const alignAfter = await page.$eval('.img-block', (el) => el.dataset.align)
check('image width survives reload', widthAfter === '50%', `width=${widthAfter}`)
check('image alignment survives reload', alignAfter === 'right', `align=${alignAfter}`)

// ---- document library --------------------------------------------------
await page.click('button[aria-label="Documents"]')
await page.waitForSelector('.drawer')
const before = (await page.$$('.drawer-item')).length
await page.click('.drawer-new')
await page.waitForTimeout(900)
await page.click('button[aria-label="Documents"]')
await page.waitForSelector('.drawer')
const after = (await page.$$('.drawer-item')).length
check('new document created', after === before + 1, `${before} -> ${after}`)

// undo must not bleed across documents
await page.click('.drawer .tool-btn[aria-label="Close"]')
await page.click(body)
await page.keyboard.type('Second document text.')
await page.waitForTimeout(900)
await page.keyboard.press('Meta+z')
await page.keyboard.press('Meta+z')
await page.keyboard.press('Meta+z')
h = await html()
check('undo does not reach the other document', !/badger|example\.com|<img/.test(h), h.slice(0, 160))

// switch back and confirm the first document is intact
await page.click('button[aria-label="Documents"]')
await page.waitForSelector('.drawer')
await page.click('.drawer-item:last-child .drawer-open')
await page.waitForTimeout(900)
h = await html()
check('switching back restores the first document', /<img/.test(h) && /example\.com/.test(h), h.slice(0, 200))

// ---- print -------------------------------------------------------------
await page.emulateMedia({ media: 'print' })
const printVis = await page.evaluate(() => {
  const vis = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).display !== 'none' : null
  }
  return { chrome: vis('.chrome'), status: vis('.status'), page: vis('.page') }
})
check('print hides chrome', printVis.chrome === false, JSON.stringify(printVis))
check('print hides status bar', printVis.status === false, JSON.stringify(printVis))
check('print keeps the page', printVis.page === true, JSON.stringify(printVis))
await page.emulateMedia({ media: 'screen' })

console.log()
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`)
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`)
console.log('console errors:', errors.length ? errors : 'none')
await browser.close()
