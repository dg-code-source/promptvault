# tests/ – Test Suite Guide

This directory contains the automated test suite for PromptVault. Tests run locally and in CI (GitHub Actions) before every deployment.

## Test Files

| File | Type | What It Tests |
|------|------|---------------|
| `test_compile_prompts.py` | Python unittest | Compiler logic: frontmatter parsing, fallback parsing, variable extraction |
| `test_html_structure.py` | Python unittest | `index.html` structure: required IDs, semantic elements, PWA meta tags |
| `test_js_app_logic.py` | Python unittest | `app.js` code patterns: localStorage keys, regex consistency, function existence |
| `test_app_logic.js` | Node.js | JS-native logic tests (run separately from the Python suite) |

---

## Running Tests

```bash
# Run all Python tests (used by CI and npm test)
python -m unittest discover -s tests -p "test_*.py"

# Run a single test file
python -m unittest tests.test_compile_prompts

# Run a specific test case
python -m unittest tests.test_compile_prompts.TestCompilePrompts.test_yaml_frontmatter_full

# Run Node.js tests
node tests/test_app_logic.js
```

---

## Test Design Principles

- **No external test framework** — use Python's built-in `unittest` only. Do NOT add pytest, Jest, or other frameworks unless explicitly approved.
- **Isolated** — tests must not depend on each other or share state. Each test case should set up and tear down its own temp files.
- **Fast** — no network calls, no file system side effects outside of `tempfile.NamedTemporaryFile`.
- **CI-compatible** — tests must pass on `ubuntu-latest` with Python 3.x (no Windows-specific assumptions).

---

## Key Test Scenarios to Always Cover

### `test_compile_prompts.py`
- YAML frontmatter parsing (full metadata)
- Markdown fallback parsing (no frontmatter)
- Variable extraction with and without defaults
- Duplicate variable names (last non-empty default wins)
- Empty frontmatter (graceful degradation)
- Files with no variables at all

### `test_html_structure.py`
- Presence of all critical DOM element IDs that `app.js` references
- Correct PWA meta tags (`viewport`, `theme-color`, `manifest`)
- Presence of Service Worker registration script
- Semantic HTML: single `<h1>`, proper `<main>` or `<section>` elements

### `test_js_app_logic.py`
- `localStorage` key constants are consistent with what the app uses
- Variable placeholder regex pattern is present and correct
- Critical functions exist in `app.js` (search by name)
- No hardcoded personal tokens or API keys in source

---

## Adding New Tests

When you add a feature to `app.js` or the compiler:

1. **New compiler behavior** → add a case in `test_compile_prompts.py`
2. **New DOM element** added to `index.html` → add an ID presence check in `test_html_structure.py`
3. **New localStorage key** → add it to the key consistency check in `test_js_app_logic.py`
4. **New JavaScript function** → verify its name appears in `app.js` via `test_js_app_logic.py`

---

## Importing the Compiler in Tests

The test file dynamically imports `compile-prompts.py` using `importlib` because the filename contains a hyphen (not a valid Python module name):

```python
import importlib.util
script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../scripts/compile-prompts.py"))
spec = importlib.util.spec_from_file_location("compile_prompts", script_path)
compile_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compile_mod)
```

Always use this pattern when referencing the compiler from tests. Do not rename `compile-prompts.py` to use underscores without updating this loader path.
