# essay

An AI-native essay editor for students: define the task, collect sources, co-plan the argument, then write with an agent that knows the plan, the sources and the document.

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY
npm run dev
```

The editor, plan and sources work without a key. Summaries, co-planning, the agent, live checkers and the final report need OpenRouter.

## Workflow

1. **Context** — task, grading scheme, length, style, language, reference pieces.
2. **Sources** — PDF and link upload, summaries, topic search.
3. **Plan** — AI co-planning, editable section cards, evidence linked to sources.
4. **Write** — Tiptap essay page, always-open agent, red/green suggestions, live checkers, APA citations.
5. **Check** — on-demand quality report, then export a clean PDF.

State lives in this browser’s IndexedDB. There are no accounts.

## API key

All AI calls go through Next.js route handlers. `OPENROUTER_API_KEY` has no `NEXT_PUBLIC_` prefix, so it never ships to the browser.

Optional model overrides in `.env.local`:

```
MODEL_STRONG=anthropic/claude-sonnet-5
MODEL_CHEAP=google/gemini-3.5-flash-lite
MODEL_JEV=~typesafe/jev-latest
```

Judgments (plan fit, rambling, citation fit, plan evidence) use Jev via OpenRouter’s Decisions API, with a cheap LLM fallback.

## Deploy

Vercel: set `OPENROUTER_API_KEY` in the project environment. `npm run build` produces a standard Next.js app.

```bash
npm run typecheck
npm run build
```
