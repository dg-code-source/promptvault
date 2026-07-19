# scripts/ – Prompt Compiler Guide

This directory contains the **prompt compilation pipeline** that transforms Markdown files in `prompts/` into the `prompts.json` data file consumed by the frontend.

## Files

| File | Purpose |
|------|---------|
| `compile-prompts.py` | **Primary compiler** — used by CI/CD pipeline and `npm run compile` |
| `compile-prompts.js` | Node.js equivalent — alternative for local use without Python |

---

## How the Compiler Works

### Entry Point
Run directly: `python scripts/compile-prompts.py`  
Or via npm: `npm run compile`

### Processing Pipeline

1. **Scan** `prompts/` directory for all `*.md` files
2. **Parse** each file via `parse_markdown_file(filepath, filename)`
3. **Write** a single `prompts.json` array to the repo root

### Parsing Strategy (in priority order)

**With YAML frontmatter** (preferred format):
```
---
title: "My Prompt"
description: "What it does"
category: "Productivity"
tags: writing, ai
---

Prompt body here with {variable} placeholders.
```

**Without frontmatter** (legacy/fallback):
- Title ← first `#` or `##` heading
- Description ← first non-empty paragraph after title
- Prompt body ← content of first triple-backtick code block
- Fallback ← all remaining text if no code block found

### Variable Extraction Regex

```python
variable_regex = r'\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}'
```

- `{variable_name}` — simple variable, no default
- `{variable_name:default value}` — variable with default
- Duplicate variable names: last occurrence with a non-empty default wins

### Output Schema (`prompts.json` entries)

```json
{
  "id": "my-prompt-filename",
  "title": "Human Readable Title",
  "description": "Short one-line description",
  "category": "Productivity",
  "tags": ["writing", "ai"],
  "prompt": "Prompt body text with {variable} placeholders",
  "variables": [
    { "name": "variable", "default": "" }
  ]
}
```

---

## Rules for Modifying the Compiler

- **Keep Python and JS compilers in sync** — both must produce identical output for identical input. If you change parsing logic in one, update the other.
- **Regex must stay consistent with `app.js`** — `app.js` uses the same variable regex pattern at runtime. If you change the variable syntax, update ALL THREE files.
- **IDs are derived from filenames** — the `id` field is `filename` without the `.md` extension. Never rename a published prompt file without considering that existing `pv_favorites` and `pv_copy_counts` in users' `localStorage` are keyed by this ID.
- **Encoding** — always read/write files with `encoding='utf-8'` to support international characters in prompt content.
- **Error tolerance** — individual file parse failures should be caught and logged, not allowed to abort the entire compilation run.

---

## Adding a New Parsing Feature

1. Update `parse_markdown_file()` in `compile-prompts.py`
2. Mirror the change in `compile-prompts.js`
3. Add a test case in `tests/test_compile_prompts.py`
4. Update `prompt_template.md` if the feature affects the prompt authoring format
5. Update `design_decisions.md` section 4 if the change affects variable syntax or fallback behavior
