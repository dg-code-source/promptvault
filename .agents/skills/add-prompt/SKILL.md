---
name: add-prompt
description: >-
  Use this skill when the user wants to add a new prompt to the PromptVault library,
  create a prompt file from scratch, write a prompt template with variables, or
  author a well-structured markdown prompt for the prompts/ directory.
---

# Skill: Add a New Prompt to PromptVault

This skill walks through creating, validating, and publishing a new prompt to the library.

---

## Step 1 – Create the Markdown File

Create a new file in `prompts/` using lowercase kebab-case naming:
```
prompts/my-prompt-name.md
```

**IMPORTANT:** The filename (without `.md`) becomes the permanent `id`. Once committed, renaming the file will break any user favorites or copy counts stored in `localStorage` under that ID.

---

## Step 2 – Write the Frontmatter

Always use YAML frontmatter. This is the preferred and fully-featured format:

```markdown
---
title: Human Readable Title
description: One sentence that explains what this prompt does and when to use it.
category: Productivity
tags: writing, ai, productivity
---

Your prompt body goes here.
```

### Frontmatter Rules
- `title`: Title-cased, descriptive, 3–8 words ideal
- `description`: One line only. Shown on the card. No punctuation at the end.
- `category`: Must match an existing category exactly (case-sensitive) OR introduce a deliberately new one. Common categories: `Productivity`, `Writing`, `Coding`, `Research`, `Communication`, `General`
- `tags`: Comma-separated, all lowercase, no quotes needed

---

## Step 3 – Write the Prompt Body with Variables

Use `{variable_name}` or `{variable_name:default value}` placeholders:

```markdown
---
title: Email Rewriter
description: Rewrites a draft email in a chosen tone and style.
category: Communication
tags: email, writing, tone
---

Rewrite the following email in a {tone:professional} tone.
Keep it under {max_words:150} words.

Email:
{email_content}
```

### Variable Rendering Rules (defined in app.js)
| Variable name contains… | Renders as |
|--------------------------|-----------|
| `text`, `content`, `document`, `context`, `message` | `<textarea>` (multi-line) |
| Anything else | `<input type="text">` (single line) |

### Variable Syntax Rules
- Variable names: letters, numbers, `_`, `-` only
- Regex: `\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}`
- Default values can contain spaces: `{tone:professional and friendly}`
- If the same variable appears multiple times, the last occurrence with a non-empty default wins

---

## Step 4 – Compile and Verify

Run the compiler to regenerate `prompts.json`:
```bash
python scripts/compile-prompts.py
```

Check the output for your new prompt:
```bash
# Verify it appears in prompts.json
python -c "import json; data=json.load(open('prompts.json')); print([p for p in data if 'my-prompt-name' in p['id']])"
```

Expected output: a JSON object with `id`, `title`, `description`, `category`, `tags`, `prompt`, and `variables`.

---

## Step 5 – Run Tests

```bash
python -m unittest discover -s tests -p "test_*.py"
```

All 14+ tests must pass. If the new prompt causes a parse failure, the compiler will log a warning but continue — check the compilation output for any `Error parsing` lines.

---

## Step 6 – Commit and Push

```bash
git add prompts/my-prompt-name.md
git commit -m "feat(prompts): add <prompt title> prompt"
git push origin main
```

The CI/CD pipeline will:
1. Re-run all tests
2. Recompile `prompts.json`
3. Deploy to GitHub Pages (~30 seconds)

---

## Common Mistakes to Avoid

- ❌ Editing `prompts.json` directly — it is always overwritten by the compiler
- ❌ Using spaces in variable names — `{my variable}` will NOT be parsed
- ❌ Wrapping the entire body in a code block — the compiler extracts the first code block as the prompt body, everything else is discarded
- ❌ Non-unique filenames — two files with the same name will collide since IDs are filename-derived
