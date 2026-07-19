# prompts/ – Prompt Library Guide

This directory is the **source of truth** for all PromptVault prompts. Each `.md` file here represents one prompt in the application.

**IMPORTANT:** Do NOT edit `prompts.json` in the repo root. Edit `.md` files here, then run the compiler to regenerate it.

---

## File Naming Convention

- Use lowercase `kebab-case`: `email-rewriter.md`, `code-refactor.md`
- The filename (without `.md`) becomes the prompt's permanent `id`
- IDs are used as keys in `pv_favorites` and `pv_copy_counts` in users' `localStorage`
- **Renaming a file breaks existing user favorites/copy-count data** — avoid unless necessary

---

## Standard Prompt Format (Recommended)

Use YAML frontmatter for all new prompts:

```markdown
---
title: Prompt Title
description: A short, one-line description of what this prompt does.
category: Productivity
tags: writing, ai, summarization
---

Your prompt body goes here. Use {variable_name} for simple placeholders
or {variable_name:default value} to pre-fill a default.

Example:
Summarize the following {content_type:article} in {count:5} bullet points:

{text}
```

---

## Variable Placeholder Syntax

| Syntax | Example | Renders as |
|--------|---------|-----------|
| `{variable_name}` | `{topic}` | Required text input field |
| `{variable_name:default}` | `{tone:professional}` | Input field pre-filled with default |
| Variable name contains "text", "content", "document", "context", or "message" | `{text}` | Textarea (multi-line) |
| All other variable names | `{count}`, `{language}` | Single-line text input |

Variable names may contain: letters, numbers, underscores (`_`), hyphens (`-`).

---

## Frontmatter Fields

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Recommended | Falls back to filename if missing |
| `description` | Recommended | Short, one-sentence summary |
| `category` | Optional | Defaults to `"General"` if missing |
| `tags` | Optional | Comma-separated list: `writing, ai, coding` |

---

## Draft Prompts

Files named `draft-*.md` (e.g., `draft-1784367067840.md`) are **local drafts** created from within the app and published to this folder via the GitHub API. They follow the same format. The numeric suffix is a timestamp used as a unique ID.

Do not manually create `draft-*.md` files — they are managed by the app's publish workflow.

---

## After Editing

Always run the compiler after adding or editing any `.md` file:

```bash
python scripts/compile-prompts.py
# or
npm run compile
```

The CI/CD pipeline runs this automatically on every push to `main`, so manually running it is only necessary for local testing.

---

## Category Conventions

Use consistent category names across prompts to avoid duplicates in the category tabs UI. Common categories:

- `Productivity`
- `Writing`
- `Coding`
- `Research`
- `Communication`
- `General`

Check existing prompts before creating a new category to avoid near-duplicates like `"coding"` vs `"Coding"` (the compiler is case-sensitive).
