---
type: index
title: PromptVault Knowledge Bundle
description: OKF (Open Knowledge Format) index for the PromptVault project. Lists all concepts, their types, and relationships to form a navigable knowledge graph for AI agents and human readers.
version: 1.2.4
created: 2026-07-19
---

# PromptVault – OKF Knowledge Bundle

This file is the entry point for the PromptVault knowledge graph. Every concept in this project is a Markdown file with a `type` field in its YAML frontmatter, following the [Google Open Knowledge Format](https://cloud.google.com/) specification.

---

## Concept Map

### `type: prompt` — Prompt Library
Individual LLM prompt templates. Each file contains frontmatter metadata and a templated prompt body with `{variable}` placeholders.

| File | Title | Category |
|------|-------|----------|
| [prompts/summarizer.md](./prompts/summarizer.md) | Text Summarizer | Writing |
| [prompts/translator.md](./prompts/translator.md) | English to Spanish Translator | Translation |
| [prompts/draft-1784367067840.md](./prompts/draft-1784367067840.md) | 10-VideoSummary | Youtube |
| [prompts/draft-1784374147658.md](./prompts/draft-1784374147658.md) | Video Bullet Summary | Youtube |

**Template for new prompts:** [prompt_template.md](./prompt_template.md)

---

### `type: architecture` — System Design
Documents describing how the system is structured and how data flows between components.

| File | Covers |
|------|--------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component diagram, data flows, state storage map, technology choices |
| [design_decisions.md](./design_decisions.md) | Authoritative log of every architectural and UX decision (13 sections) |

---

### `type: guide` — Human & Agent Guides
How-to documentation for contributors, maintainers, and AI coding agents.

| File | Audience |
|------|----------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Human contributors — adding prompts and contributing code |
| [CLAUDE.md](./CLAUDE.md) | AI agents — project constraints, localStorage keys, commands |
| [.github/CLAUDE.md](./.github/CLAUDE.md) | AI agents — GitHub Actions workflow context |
| [scripts/CLAUDE.md](./scripts/CLAUDE.md) | AI agents — compiler script context |
| [tests/CLAUDE.md](./tests/CLAUDE.md) | AI agents — test suite context |

---

### `type: policy` — Governance & Legal
Project policies covering security, conduct, and licensing.

| File | Covers |
|------|--------|
| [SECURITY.md](./SECURITY.md) | Security model, token scoping, threat model, vulnerability reporting |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards (Contributor Covenant v2.1) |
| [LICENSE](./LICENSE) | MIT License |

---

### `type: changelog` — Release History
| File | Covers |
|------|--------|
| [CHANGELOG.md](./CHANGELOG.md) | Feature history from v1.0.0 → v1.2.4 |

---

## Cross-link Graph

```
okf/index.md (this file)
│
├── prompts/*.md          ← type: prompt (the core data)
│     └── compiled by scripts/compile-prompts.py → prompts.json
│
├── ARCHITECTURE.md       ← type: architecture
│     └── references design_decisions.md
│
├── design_decisions.md   ← type: architecture
│     └── referenced by CONTRIBUTING.md, CLAUDE.md
│
├── CONTRIBUTING.md       ← type: guide
│     └── references ARCHITECTURE.md, design_decisions.md, CLAUDE.md
│
├── CLAUDE.md             ← type: guide (AI agent context)
│     └── references design_decisions.md
│
├── SECURITY.md           ← type: policy
├── CODE_OF_CONDUCT.md    ← type: policy
├── LICENSE               ← type: policy
│
└── CHANGELOG.md          ← type: changelog
```

---

## Compiler Output

Prompts are compiled from `prompts/*.md` → `prompts.json` by:
- **Python**: [scripts/compile-prompts.py](./scripts/compile-prompts.py) (used by CI/CD)
- **Node.js**: [scripts/compile-prompts.js](./scripts/compile-prompts.js) (local dev)

The compiled `prompts.json` includes the `type` field from each file's frontmatter, making it queryable by AI agents consuming the JSON output.

---

## CI/CD

| File | Purpose |
|------|---------|
| [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) | Test → Compile → Deploy to GitHub Pages on push to `main` |
