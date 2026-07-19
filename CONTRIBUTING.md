---
type: guide
title: Contributing to PromptVault
description: How to add prompts (no code required) and how to contribute code changes, including setup, workflow, constraints, and commit format.
related:
  - ARCHITECTURE.md
  - design_decisions.md
  - CLAUDE.md
  - okf/index.md
---

# Contributing to PromptVault

There are two ways to contribute: **adding prompts** (no coding required) and **contributing code**.

---

## Option A: Adding a New Prompt (No Code Required)

### 1. Create a Markdown file in `prompts/`

Name it using lowercase kebab-case: `my-prompt-name.md`

The filename becomes the prompt's permanent ID — avoid renaming after publishing.

### 2. Use this format

```markdown
---
title: Descriptive Title Here
description: One sentence explaining what this prompt does.
category: Productivity
tags: writing, ai, productivity
---

Your prompt body here. Use {variable_name} for inputs
or {variable_name:default value} to pre-fill defaults.

Example:
Summarize the following {content_type:article} in {count:5} points:

{text}
```

### 3. Variable syntax rules

| Syntax | Example | Renders as |
|--------|---------|-----------|
| `{name}` | `{topic}` | Text input field |
| `{name:default}` | `{tone:formal}` | Text input pre-filled with default |
| Name contains `text`, `content`, `document`, `context`, `message` | `{text}` | Multi-line textarea |

### 4. Category guidelines

Use an existing category to keep the UI clean:
`Productivity`, `Writing`, `Coding`, `Research`, `Communication`, `General`

To add a new category, use it in your frontmatter — it will appear automatically.

### 5. Submit

Commit your `.md` file and push (or open a Pull Request). The CI pipeline automatically:
- Runs all tests
- Recompiles `prompts.json`
- Deploys to GitHub Pages

---

## Option B: Contributing Code

### Prerequisites

- Python 3.x
- Node.js 18+ (for Vite dev server)

### Setup

```bash
git clone https://github.com/dg-code-source/promptvault.git
cd promptvault
npm install
```

### Development workflow

```bash
# Start dev server
npm run dev

# Compile prompts after any .md file change
npm run compile

# Run test suite before committing
npm test
```

### Project architecture

Before making code changes, read:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system diagram and data flows
- [`design_decisions.md`](./design_decisions.md) — authoritative record of every architectural decision
- [`CLAUDE.md`](./CLAUDE.md) — constraints and conventions for this codebase

### Core constraints to respect

1. **No runtime npm dependencies** — `app.js` must stay framework-free
2. **No backend** — all state in `localStorage` or GitHub via REST API
3. **Single-file per concern** — `app.js`, `app.css`, `index.html` are intentionally monolithic
4. **Mobile-first** — test all UI changes at 375px viewport width
5. **Toasts at top** — notification toasts must use `top` positioning, not `bottom` (Android clipboard popup conflict)
6. **Clipboard fallback** — always use `navigator.clipboard` with `execCommand('copy')` fallback
7. **Bump CACHE_NAME** — any change to `app.js`, `app.css`, `index.html`, or `sw.js` requires incrementing the version in `sw.js`

### Test requirements

All tests must pass before pushing:
```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

When adding a feature:
- New DOM element ID → add to `tests/test_html_structure.py`
- New localStorage key → add to `tests/test_js_app_logic.py`
- New compiler behaviour → add a case to `tests/test_compile_prompts.py`

### Commit message format

```
type(scope): short description

feat(prompts): add email rewriter prompt
feat(app): add keyboard shortcut for copy
fix(compiler): handle empty frontmatter gracefully
fix(sw): bump cache version after CSS changes
docs: update ARCHITECTURE.md with new data flow
test: add coverage for duplicate variable extraction
```

---

## What NOT to Submit

- Changes to `prompts.json` directly (it is always auto-generated)
- Prompts containing copyrighted content or personally identifying information
- Code that introduces React, Vue, or any frontend framework
- New npm runtime dependencies
- Hardcoded credentials of any kind

---

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture and data flows
- [design_decisions.md](./design_decisions.md) — Authoritative architectural decisions log
- [SECURITY.md](./SECURITY.md) — Token scoping and security model
- [CLAUDE.md](./CLAUDE.md) — AI agent guide for this codebase
- [okf/index.md](./okf/index.md) — OKF knowledge graph index
