const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '../prompts');
const OUTPUT_FILE = path.join(__dirname, '../prompts.json');

// Ensure output directories exist
if (!fs.existsSync(PROMPTS_DIR)) {
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });
}

function parseMarkdownFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf8');
  const id = path.basename(filename, '.md');
  
  let title = id.replace(/[-_]/g, ' ');
  // Capitalize title words
  title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  let description = '';
  let category = 'General';
  let tags = [];
  let promptBody = '';
  
  // 1. Check for frontmatter
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  
  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1];
    promptBody = content.slice(frontmatterMatch[0].length);
    
    // Parse frontmatter line-by-line
    const lines = yamlBlock.split(/\r?\n/);
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        let val = line.slice(colonIndex + 1).trim();
        
        // Strip wrapping quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        
        if (key === 'title') {
          title = val;
        } else if (key === 'description') {
          description = val;
        } else if (key === 'category') {
          category = val;
        } else if (key === 'tags') {
          tags = val.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
      }
    });
  } else {
    // No frontmatter: Parse text structure
    const lines = content.split(/\r?\n/);
    let titleIndex = -1;
    let descIndex = -1;
    let inCodeBlock = false;
    let codeBlockLines = [];
    let fallbackTextLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract title from first H1/H2 heading
      if ((line.startsWith('#') || line.startsWith('##')) && titleIndex === -1) {
        title = line.replace(/^#+\s*/, '');
        titleIndex = i;
        continue;
      }
      
      // Parse description: first non-empty paragraph after title
      if (titleIndex !== -1 && line.length > 0 && descIndex === -1 && !line.startsWith('#') && !line.startsWith('```')) {
        description = line;
        descIndex = i;
        continue;
      }
      
      // Extract code block
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockLines.push(lines[i]); // Keep original line indentation
      } else if (titleIndex !== -1 && i > titleIndex && i !== descIndex) {
        fallbackTextLines.push(lines[i]);
      }
    }
    
    if (codeBlockLines.length > 0) {
      promptBody = codeBlockLines.join('\n');
    } else {
      promptBody = fallbackTextLines.join('\n').trim();
    }
  }

  // 2. Extract first code block from promptBody if it's markdown-formatted promptBody
  const codeBlockMatch = promptBody.match(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/);
  if (codeBlockMatch) {
    promptBody = codeBlockMatch[1];
  } else {
    promptBody = promptBody.trim();
  }
  
  // 3. Extract variables with default values from the prompt body
  // Matches {variable} or {variable:default_value}
  const variableRegex = /\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}/g;
  const variablesMap = new Map();
  let match;
  
  while ((match = variableRegex.exec(promptBody)) !== null) {
    const varName = match[1];
    const defaultValue = match[2] || '';
    
    // Store first occurrence or override with default if found later
    if (!variablesMap.has(varName) || defaultValue !== '') {
      variablesMap.set(varName, defaultValue);
    }
  }
  
  const variables = Array.from(variablesMap.entries()).map(([name, defVal]) => ({
    name,
    default: defVal
  }));

  return {
    id,
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    tags,
    prompt: promptBody,
    variables
  };
}

function compile() {
  console.log('Compiling prompts...');
  try {
    const files = fs.readdirSync(PROMPTS_DIR);
    const compiledPrompts = [];
    
    files.forEach(file => {
      if (file.endsWith('.md')) {
        const filePath = path.join(PROMPTS_DIR, file);
        try {
          const parsed = parseMarkdownFile(filePath, file);
          compiledPrompts.push(parsed);
          console.log(`- Successfully parsed: ${file} [Category: ${parsed.category}, Variables: ${parsed.variables.length}]`);
        } catch (err) {
          console.error(`Error parsing ${file}:`, err);
        }
      }
    });
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(compiledPrompts, null, 2), 'utf8');
    console.log(`\nCompilation complete! Saved ${compiledPrompts.length} prompts to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Failed to read prompts directory:', err);
    process.exit(1);
  }
}

compile();
