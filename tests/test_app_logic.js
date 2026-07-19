// JavaScript Logic Unit Test Suite for PromptVault
const assert = require('assert');

// 1. Test Client-Side Markdown Renderer Logic
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (triple backticks)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (# H1, ## H2, ### H3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Bullet lists (* or -)
  html = html.replace(/^\s*[\*\-] (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/sim, '<ul>$1</ul>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// 2. Test Variable Compilation Logic
function compilePromptTextSimulated(template, inputValuesMap) {
  let compiled = template;
  const variableRegex = /\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}/g;
  
  let match;
  const varsFound = [];
  while ((match = variableRegex.exec(template)) !== null) {
    varsFound.push({ name: match[1], default: match[2] || '' });
  }

  varsFound.forEach(v => {
    let userVal = inputValuesMap[v.name];
    if (userVal === undefined || userVal.trim() === '') {
      userVal = v.default;
    }
    const escapedVarName = v.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\{' + escapedVarName + '(?::[^}]*)?\\}', 'g');
    compiled = compiled.replace(regex, userVal);
  });

  return compiled;
}

// 3. Test Sorting Logic
function sortPrompts(prompts, sortMode, copyCounts) {
  const copy = [...prompts];
  if (sortMode === 'most-copied') {
    copy.sort((a, b) => (copyCounts[b.id] || 0) - (copyCounts[a.id] || 0));
  } else if (sortMode === 'alphabetical') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy;
}

// EXECUTE TEST SUITE
console.log('Running JavaScript Unit Test Suite...');

// Test 1: HTML Sanitization & Markdown Formatting
const rawMd = '# Title\n**Bold** and *Italic*\n`code`\n<script>alert(1)</script>';
const rendered = renderMarkdown(rawMd);
assert(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'HTML tags should be escaped');
assert(rendered.includes('<h1>Title</h1>'), 'H1 should render correctly');
assert(rendered.includes('<strong>Bold</strong>'), 'Bold should render correctly');
assert(rendered.includes('<em>Italic</em>'), 'Italic should render correctly');
assert(rendered.includes('<code>code</code>'), 'Inline code should render correctly');
console.log('✓ Test 1 Passed: Markdown rendering & HTML sanitization');

// Test 2: Variable Compilation with Defaults & Custom Inputs
const template = 'Summarize in {count:3} points: {text}';
const compiledWithDefaults = compilePromptTextSimulated(template, { text: 'Hello World' });
assert.strictEqual(compiledWithDefaults, 'Summarize in 3 points: Hello World');

const compiledWithCustom = compilePromptTextSimulated(template, { count: '5', text: 'Custom Text' });
assert.strictEqual(compiledWithCustom, 'Summarize in 5 points: Custom Text');
console.log('✓ Test 2 Passed: Variable text compilation');

// Test 3: Prompt Sorting
const samplePrompts = [
  { id: 'p1', title: 'Zebra Prompt' },
  { id: 'p2', title: 'Alpha Prompt' },
  { id: 'p3', title: 'Beta Prompt' }
];
const copyCounts = { p1: 10, p2: 5, p3: 20 };

const sortedAlphabetical = sortPrompts(samplePrompts, 'alphabetical', copyCounts);
assert.strictEqual(sortedAlphabetical[0].title, 'Alpha Prompt');
assert.strictEqual(sortedAlphabetical[2].title, 'Zebra Prompt');

const sortedMostCopied = sortPrompts(samplePrompts, 'most-copied', copyCounts);
assert.strictEqual(sortedMostCopied[0].id, 'p3'); // 20 copies
assert.strictEqual(sortedMostCopied[1].id, 'p1'); // 10 copies
assert.strictEqual(sortedMostCopied[2].id, 'p2'); // 5 copies
console.log('✓ Test 3 Passed: Prompt sorting algorithms');

console.log('\nAll JavaScript Unit Tests Passed Successfully!');
