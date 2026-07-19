---
name: run-and-fix-tests
description: >-
  Use this skill when the user wants to run the PromptVault test suite, a test is
  failing and needs to be diagnosed, a new feature needs test coverage, or the CI
  pipeline is failing on the test step. Covers Python unittest and Node.js tests.
---

# Skill: Run and Fix PromptVault Tests

The test suite is the gate that protects every GitHub Pages deployment. All tests
must pass before any push reaches production.

---

## Running Tests

```bash
# Full suite (used by CI and npm test)
python -m unittest discover -s tests -p "test_*.py"

# Single file
python -m unittest tests.test_compile_prompts
python -m unittest tests.test_html_structure
python -m unittest tests.test_js_app_logic

# Single test case
python -m unittest tests.test_compile_prompts.TestCompilePrompts.test_yaml_frontmatter_full

# Verbose output (shows each test name)
python -m unittest discover -s tests -p "test_*.py" -v

# Node.js tests (run separately)
node tests/test_app_logic.js
```

---

## Test Suite Map

### `test_compile_prompts.py` — Compiler Logic
Tests the `parse_markdown_file()` function in `scripts/compile-prompts.py`.
Uses `tempfile.NamedTemporaryFile` — no real `prompts/` directory is touched.

Key cases:
- `test_yaml_frontmatter_full` — full metadata parsing
- `test_markdown_fallback_parsing` — no-frontmatter document structure
- `test_duplicate_variable_extraction` — last non-empty default wins
- `test_empty_frontmatter` — graceful degradation to filename-based title

### `test_html_structure.py` — DOM Integrity
Parses `index.html` as text and checks for required element IDs and meta tags.
Fails if a DOM element that `app.js` references is missing.

### `test_js_app_logic.py` — JS Code Patterns
Reads `app.js` as text and uses regex/string matching to verify:
- `localStorage` keys are present and consistent
- Variable placeholder regex pattern is correct
- Critical function names exist
- No hardcoded secrets

---

## Diagnosing a Failing Test

### Pattern: Compiler test fails

```
AssertionError: 'Expected Title' != 'Actual Title'
```

1. Read the test to understand the input markdown content
2. Run `parse_markdown_file` manually in a Python shell:
   ```python
   import importlib.util, os
   spec = importlib.util.spec_from_file_location("cp", "scripts/compile-prompts.py")
   mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
   # Write a temp file and call mod.parse_markdown_file(path, filename)
   ```
3. Check: frontmatter regex, key parsing, variable regex

### Pattern: HTML structure test fails

```
AssertionError: 'id="my-new-element"' not found in index.html
```

The test expects a DOM ID that is either:
- Missing from `index.html` (add it), OR
- Present but was removed during a refactor (restore it or update the test)

### Pattern: JS logic test fails

```
AssertionError: 'pv_new_key' not found in app.js
```

A new `localStorage` key was added to one list but not the test. Update `test_js_app_logic.py` to include the key.

---

## Adding a Test for a New Feature

### New compiler behaviour → `test_compile_prompts.py`

```python
def test_my_new_feature(self):
    content = """---
title: "Test"
my_new_field: value
---
Prompt body."""
    with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.md', encoding='utf-8') as f:
        f.write(content)
        f_path = f.name
    try:
        parsed = parse_markdown_file(f_path, os.path.basename(f_path))
        self.assertEqual(parsed['my_new_field'], 'value')
    finally:
        os.remove(f_path)
```

**Always** use `try/finally` to clean up temp files, even on test failure.

### New DOM element → `test_html_structure.py`

Add the new element ID to the existing list of required IDs checked in the test.

### New localStorage key → `test_js_app_logic.py`

Add the new key string (e.g. `'pv_my_feature'`) to the list of expected keys.

### New function in app.js → `test_js_app_logic.py`

Add the function name to the list of expected function definitions checked via string match.

---

## CI Failure: Tests Fail in GitHub Actions but Pass Locally

Common causes:
- **Line endings**: `app.js` uses CRLF on Windows; GitHub Actions runs on Linux. String-match tests using `\n` may fail. Use `\r?\n` in regex or `.replace('\r\n', '\n')` before matching.
- **Path separators**: Always use `os.path.join()` in Python, never hardcoded `/` or `\`
- **Python version**: CI uses `python-version: '3.x'` (latest stable). If you use a 3.x-only feature, it will work; if you use a 3.12+ feature, verify it is available.
- **Encoding**: Always open files with `encoding='utf-8'` — the default may differ on Linux vs Windows.

---

## Verification After Fixing

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

All tests must show `OK`. Then commit:
```bash
git add tests/
git commit -m "test: add coverage for <feature>"
```
