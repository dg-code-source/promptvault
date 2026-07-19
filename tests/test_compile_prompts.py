import unittest
import os
import json
import tempfile
import importlib.util

script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../scripts/compile-prompts.py'))
spec = importlib.util.spec_from_file_location("compile_prompts", script_path)
compile_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compile_mod)

parse_markdown_file = compile_mod.parse_markdown_file
compile_prompts = compile_mod.compile_prompts

class TestCompilePrompts(unittest.TestCase):

    def test_yaml_frontmatter_full(self):
        content = """---
title: "Advanced AI Summarizer"
description: 'Summarizes long articles with bullet points.'
category: "Productivity"
tags: writing, ai, summarization
---

Write a summary of the text below in {count:5} points:

{text}"""
        with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.md', encoding='utf-8') as f:
            f.write(content)
            f_path = f.name

        try:
            parsed = parse_markdown_file(f_path, os.path.basename(f_path))
            self.assertEqual(parsed['title'], "Advanced AI Summarizer")
            self.assertEqual(parsed['description'], "Summarizes long articles with bullet points.")
            self.assertEqual(parsed['category'], "Productivity")
            self.assertEqual(parsed['tags'], ["writing", "ai", "summarization"])
            self.assertEqual(len(parsed['variables']), 2)
            self.assertEqual(parsed['variables'][0]['name'], 'count')
            self.assertEqual(parsed['variables'][0]['default'], '5')
            self.assertEqual(parsed['variables'][1]['name'], 'text')
            self.assertEqual(parsed['variables'][1]['default'], '')
        finally:
            os.remove(f_path)

    def test_markdown_fallback_parsing(self):
        content = """# Code Refactoring Prompt

Refactors messy JavaScript code to modern ES6 syntax.

```javascript
Refactor the following {language:JavaScript} code:

{code}
```"""
        with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.md', encoding='utf-8') as f:
            f.write(content)
            f_path = f.name

        try:
            parsed = parse_markdown_file(f_path, "code-refactor.md")
            self.assertEqual(parsed['id'], "code-refactor")
            self.assertEqual(parsed['title'], "Code Refactoring Prompt")
            self.assertEqual(parsed['description'], "Refactors messy JavaScript code to modern ES6 syntax.")
            self.assertIn("Refactor the following", parsed['prompt'])
            self.assertEqual(len(parsed['variables']), 2)
            var_names = [v['name'] for v in parsed['variables']]
            self.assertIn("language", var_names)
            self.assertIn("code", var_names)
        finally:
            os.remove(f_path)

    def test_duplicate_variable_extraction(self):
        content = """---
title: "Duplicate Variable Test"
---

{topic} is great. Tell me more about {topic} in {style:formal} tone. Duplicate {topic:default_override}."""

        with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.md', encoding='utf-8') as f:
            f.write(content)
            f_path = f.name

        try:
            parsed = parse_markdown_file(f_path, "dup-test.md")
            self.assertEqual(len(parsed['variables']), 2)
            topic_var = next(v for v in parsed['variables'] if v['name'] == 'topic')
            self.assertEqual(topic_var['default'], 'default_override')
        finally:
            os.remove(f_path)

    def test_empty_frontmatter(self):
        content = """---
---
Basic prompt text with {var1}."""

        with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.md', encoding='utf-8') as f:
            f.write(content)
            f_path = f.name

        try:
            parsed = parse_markdown_file(f_path, "basic.md")
            self.assertEqual(parsed['id'], "basic")
            self.assertEqual(parsed['title'], "Basic")
            self.assertEqual(parsed['category'], "General")
        finally:
            os.remove(f_path)

if __name__ == '__main__':
    unittest.main()
