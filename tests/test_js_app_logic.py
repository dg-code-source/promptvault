import unittest
import re

def render_markdown(text):
    if not text:
        return ''
    html = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    html = re.sub(r'```([\s\S]*?)```', r'<pre><code>\1</code></pre>', html)
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    html = re.sub(r'^### (.*$)', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*$)', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.*$)', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', html)
    html = re.sub(r'^\s*[\*-] (.*$)', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'(<li>.*</li>)', r'<ul>\1</ul>', html, flags=re.DOTALL)
    html = html.replace('\n', '<br>')
    return html

def compile_prompt_text_simulated(template, input_values_map):
    compiled = template
    variable_regex = re.compile(r'\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}')
    matches = variable_regex.findall(template)
    
    for var_name, default_val in matches:
        user_val = input_values_map.get(var_name)
        if user_val is None or str(user_val).strip() == '':
            user_val = default_val
        escaped_name = re.escape(var_name)
        pattern = re.compile(r'\{' + escaped_name + r'(?::[^}]*)?\}')
        compiled = pattern.sub(lambda m: str(user_val), compiled)
    return compiled

def slugify(text):
    text = str(text).lower()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'[^\w\-]+', '', text)
    text = re.sub(r'\-\-+', '-', text)
    text = re.sub(r'^-+', '', text)
    text = re.sub(r'-+$', '', text)
    return text

def resolve_category(selected_val, custom_input_val):
    if selected_val == '__custom__':
        return custom_input_val.strip() if custom_input_val and custom_input_val.strip() else 'General'
    return selected_val if selected_val else 'General'

def process_tags(selected_tags_set, pending_input_val):
    final_set = set(selected_tags_set)
    if pending_input_val and pending_input_val.strip():
        tokens = [t.strip().lower() for t in pending_input_val.split(',') if t.strip()]
        for t in tokens:
            final_set.add(t)
    return sorted(list(final_set))

def get_all_categories_simulated(prompts, drafts):
    all_prompts = prompts + drafts
    cats = list(dict.fromkeys([p['category'] for p in all_prompts if p.get('category')]))
    return cats if cats else ['General']

class TestJSAppLogic(unittest.TestCase):

    def test_markdown_rendering_and_sanitization(self):
        raw_md = '# Title\n**Bold** and *Italic*\n`code`\n<script>alert(1)</script>'
        rendered = render_markdown(raw_md)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', rendered)
        self.assertIn('<h1>Title</h1>', rendered)
        self.assertIn('<strong>Bold</strong>', rendered)
        self.assertIn('<em>Italic</em>', rendered)
        self.assertIn('<code>code</code>', rendered)

    def test_variable_compilation(self):
        template = 'Summarize in {count:3} points: {text}'
        compiled_defaults = compile_prompt_text_simulated(template, {'text': 'Hello World'})
        self.assertEqual(compiled_defaults, 'Summarize in 3 points: Hello World')

        compiled_custom = compile_prompt_text_simulated(template, {'count': '5', 'text': 'Custom Text'})
        self.assertEqual(compiled_custom, 'Summarize in 5 points: Custom Text')

    def test_new_category_addition_and_resolution(self):
        self.assertEqual(resolve_category('Writing', ''), 'Writing')
        self.assertEqual(resolve_category('__custom__', '  SEO & Growth  '), 'SEO & Growth')
        self.assertEqual(resolve_category('__custom__', '   '), 'General')

        prompts = [{'id': '1', 'category': 'General'}]
        drafts = [{'id': 'd1', 'category': 'SEO & Growth'}]
        cats = get_all_categories_simulated(prompts, drafts)
        self.assertIn('SEO & Growth', cats)

    def test_new_tag_addition_normalization_and_reset(self):
        selected = set(['writing', 'code'])
        updated = process_tags(selected, '  AI , Productivity ,  code  ')
        self.assertEqual(len(updated), 4)
        self.assertIn('ai', updated)
        self.assertIn('productivity', updated)

        # Reset tag set on new draft open
        selected.clear()
        self.assertEqual(len(selected), 0)
        new_tags = process_tags(selected, 'brand-new-tag')
        self.assertEqual(new_tags, ['brand-new-tag'])

    def test_variable_compilation_special_chars(self):
        template = 'Regex string: {var}'
        compiled = compile_prompt_text_simulated(template, {'var': r'\g<0> and \1'})
        self.assertEqual(compiled, r'Regex string: \g<0> and \1')

    def test_slugify(self):
        self.assertEqual(slugify('My Cool Prompt!'), 'my-cool-prompt')
        self.assertEqual(slugify('  SEO & Marketing 2024  '), 'seo-marketing-2024')

if __name__ == '__main__':
    unittest.main()
