import os
import re
import json

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), '../prompts')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '../prompts.json')

def parse_markdown_file(filepath, filename):
    prompt_id = os.path.splitext(filename)[0]
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Generate default title from filename
    title = prompt_id.replace('-', ' ').replace('_', ' ').title()
    description = ""
    category = "General"
    tags = []
    prompt_body = ""
    
    # 1. Parse frontmatter if present
    frontmatter_match = re.match(r'^---\r?\n([\s\S]*?)\r?\n---\r?\n', content)
    
    if frontmatter_match:
        yaml_block = frontmatter_match.group(1)
        prompt_body = content[frontmatter_match.end():]
        
        for line in yaml_block.splitlines():
            if ':' in line:
                parts = line.split(':', 1)
                key = parts[0].strip().lower()
                val = parts[1].strip()
                
                # Strip wrapping quotes
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                
                if key == 'title':
                    title = val
                elif key == 'description':
                    description = val
                elif key == 'category':
                    category = val
                elif key == 'tags':
                    tags = [t.strip() for t in val.split(',') if t.strip()]
    else:
        # No frontmatter: parse document structure
        lines = content.splitlines()
        title_index = -1
        desc_index = -1
        in_code_block = False
        code_block_lines = []
        fallback_lines = []
        
        for i, line in enumerate(lines):
            trimmed = line.strip()
            
            # Extract H1 or H2 heading
            if (trimmed.startswith('#') or trimmed.startswith('##')) and title_index == -1:
                title = re.sub(r'^#+\s*', '', trimmed)
                title_index = i
                continue
            
            # Extract description
            if title_index != -1 and len(trimmed) > 0 and desc_index == -1 and not trimmed.startswith('#') and not trimmed.startswith('```'):
                description = trimmed
                desc_index = i
                continue
            
            # Extract code blocks
            if trimmed.startswith('```'):
                in_code_block = not in_code_block
                continue
                
            if in_code_block:
                code_block_lines.append(line)
            elif title_index != -1 and i > title_index and i != desc_index:
                fallback_lines.append(line)
                
        if code_block_lines:
            prompt_body = '\n'.join(code_block_lines)
        else:
            prompt_body = '\n'.join(fallback_lines).strip()
            
    # 2. Extract first code block from body if wrapped in backticks
    code_block_match = re.search(r'```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```', prompt_body)
    if code_block_match:
        prompt_body = code_block_match.group(1)
    else:
        prompt_body = prompt_body.strip()
        
    # 3. Extract variables with default values: {variable_name:default_value}
    # Variable name can be alphanumeric, dashes or underscores
    variable_regex = r'\{([a-zA-Z0-9_-]+)(?::([^}]+))?\}'
    variables_map = {}
    
    for match in re.finditer(variable_regex, prompt_body):
        var_name = match.group(1)
        default_val = match.group(2) if match.group(2) else ""
        
        # Register first encounter or update if default value is specified later
        if var_name not in variables_map or default_val != "":
            variables_map[var_name] = default_val
            
    variables = [{"name": name, "default": def_val} for name, def_val in variables_map.items()]
    
    return {
        "id": prompt_id,
        "title": title,
        "description": description,
        "category": category,
        "tags": tags,
        "prompt": prompt_body,
        "variables": variables
    }

def compile_prompts():
    print("Compiling prompts from Markdown files...")
    
    if not os.path.exists(PROMPTS_DIR):
        os.makedirs(PROMPTS_DIR)
        print(f"Created prompts directory: {PROMPTS_DIR}")
        
    compiled_list = []
    
    for filename in os.listdir(PROMPTS_DIR):
        if filename.endswith('.md'):
            filepath = os.path.join(PROMPTS_DIR, filename)
            try:
                parsed = parse_markdown_file(filepath, filename)
                compiled_list.append(parsed)
                print(f"- Parsed '{filename}' [Category: {parsed['category']}, Variables: {len(parsed['variables'])}]")
            except Exception as e:
                print(f"Error parsing '{filename}': {e}")
                
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(compiled_list, f, indent=2, ensure_ascii=False)
        
    print(f"\nCompilation complete! Saved {len(compiled_list)} prompts to: {OUTPUT_FILE}")

if __name__ == '__main__':
    compile_prompts()
