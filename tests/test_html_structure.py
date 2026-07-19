import unittest
import os
from html.parser import HTMLParser

class HTMLSyntaxValidator(HTMLParser):
    VOID_ELEMENTS = {
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    }

    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.ids = set()
        self.duplicate_ids = set()

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if 'id' in attr_dict:
            elem_id = attr_dict['id']
            if elem_id in self.ids:
                self.duplicate_ids.add(elem_id)
            self.ids.add(elem_id)

        if tag.lower() not in self.VOID_ELEMENTS:
            self.stack.append(tag.lower())

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in self.VOID_ELEMENTS:
            return

        if not self.stack:
            self.errors.append(f"Unexpected closing tag </{tag}> with empty stack")
            return

        if self.stack[-1] == tag_lower:
            self.stack.pop()
        else:
            self.errors.append(f"Mismatched closing tag </{tag}>. Expected </{self.stack[-1]}>")

class TestHTMLStructure(unittest.TestCase):

    def test_index_html_syntax_and_structure(self):
        index_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../index.html'))
        self.assertTrue(os.path.exists(index_path), "index.html must exist")

        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()

        parser = HTMLSyntaxValidator()
        parser.feed(content)

        # 1. Assert no unclosed HTML tags
        self.assertEqual(len(parser.stack), 0, f"Unclosed tags remaining: {parser.stack}")

        # 2. Assert no tag mismatch errors
        self.assertEqual(len(parser.errors), 0, f"HTML syntax errors found: {parser.errors}")

        # 3. Assert no duplicate element IDs
        self.assertEqual(len(parser.duplicate_ids), 0, f"Duplicate IDs found: {parser.duplicate_ids}")

        # 4. Assert critical PWA element IDs exist
        required_ids = [
            'prompts-grid', 'category-tabs', 'sort-pills', 'search-input',
            'draft-modal', 'draft-form', 'draft-title', 'draft-desc',
            'draft-cat-select', 'draft-cat-custom', 'selected-tags-wrapper',
            'new-tag-input', 'add-tag-btn', 'existing-tags-chips',
            'draft-prompt-tab-edit', 'draft-prompt-tab-preview',
            'draft-prompt', 'draft-prompt-preview', 'setting-github-token',
            'setting-gemini-key', 'ai-runner-modal'
        ]
        for req_id in required_ids:
            self.assertIn(req_id, parser.ids, f"Required element ID '{req_id}' missing in index.html")

    def test_modal_css_scroll_and_fullscreen_rules(self):
        css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../app.css'))
        self.assertTrue(os.path.exists(css_path), "app.css must exist")

        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()

        # 1. Verify modal body overflow-y rule
        self.assertIn('.modal-body', css_content, "CSS must define .modal-body rules")
        self.assertIn('overflow-y: auto', css_content, "CSS must include overflow-y: auto for modal bodies")
        self.assertIn('-webkit-overflow-scrolling: touch', css_content, "CSS must include smooth touch scrolling for mobile modals")

        # 2. Verify mobile fullscreen media query rules
        self.assertIn('@media (max-width: 640px)', css_content, "CSS must include mobile breakpoint media queries")
        self.assertIn('100vw', css_content, "CSS must include 100vw fullscreen sizing for mobile dialogs")
        self.assertIn('100vh', css_content, "CSS must include 100vh fullscreen sizing for mobile dialogs")

if __name__ == '__main__':
    unittest.main()
