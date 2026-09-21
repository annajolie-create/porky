# Porky

A word processor that runs in your browser. Write an essay, format it the way
you would in Word or Google Docs, and print it — or save it as a PDF — on a
real A4 page.

```bash
npm install
cp .env.example .env.local   # add your Anthropic API key for the assistant
npm run dev
```

The editor works without a key; only the assistant panel needs one.

## What it does

**Writing** — paragraphs and three heading levels, bold, italic, underline,
strikethrough, subscript and superscript, inline code, code blocks, block
quotes and horizontal rules.

**Type** — nine font families, sizes from 8 to 72 point, text colour and
highlight.

**Layout** — left, centre, right and justified alignment, bulleted and
numbered lists, indent and outdent with Tab, and line spacing from single to
triple.

**Images** — insert from a file, paste a screenshot, or drag a file onto the
page. Drag the side handles to resize, or pick a width preset, and align left,
centre or right.

**Links** — Ctrl/Cmd + K, or the toolbar. Typed URLs link themselves.

**Documents** — the drawer holds as many as you like, sorted by when you last
touched them, with rename, duplicate and delete. Everything saves as you type.

**Assistant** — a Claude panel on the right that can see the document and your
current selection. Ask it to summarise, tighten, critique or continue, then
insert or copy the reply. Runs on Claude Haiku 4.5.

**Printing** — Ctrl/Cmd + P. The print stylesheet keeps headings with the text
that follows them, stops images splitting across pages, and preserves colour
and highlighting. Your browser's "Save as PDF" produces selectable, searchable
text, and suggests the document's title as the filename.

## Where documents live

In this browser's IndexedDB, on this device. They are not uploaded anywhere,
not synced between machines, and not backed up — clearing your browser's site
data deletes them. Print to PDF for anything you want to keep.

Images are embedded directly in the document so it stays self-contained. They
are scaled down to 1600px on the long edge and re-encoded as WebP on the way
in, which keeps a phone photo from costing several megabytes; anything over
12 MB is refused.

## The API key

The assistant calls Claude through a small Node handler (`server/assistant.ts`)
mounted into the Vite dev and preview servers. The key lives in `.env.local`,
has no `VITE_` prefix, and is therefore never inlined into the browser bundle —
it stays on the server side of `/api/assistant`.

That matters because everything else here is a static site. A key with a `VITE_`
prefix, or one written into a source file, would ship to every visitor in plain
text. If you deploy this as a static build, `/api/assistant` will not exist and
the panel will report that it cannot reach the assistant; giving it a real
backend is the fix, not moving the key into the client.

## Keyboard

| | |
|---|---|
| `Cmd/Ctrl + B` `I` `U` | Bold, italic, underline |
| `Cmd/Ctrl + K` | Link |
| `Tab` / `Shift + Tab` | Indent, or nest a list item |
| `Cmd/Ctrl + ]` / `[` | Indent, outdent |
| `Cmd/Ctrl + \` | Clear formatting |
| `Cmd/Ctrl + Alt + 1…3` | Heading 1 to 3 |
| `Cmd/Ctrl + P` | Print or save as PDF |

## Built with

React 19, Vite and [Tiptap](https://tiptap.dev) on ProseMirror. No backend.

```bash
npm run build   # typecheck and bundle
npm run lint    # oxlint
```
