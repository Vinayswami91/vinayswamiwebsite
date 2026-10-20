"""Check llms.txt: llmstxt.org shape, a when-to-use section, and every linked page exists in this folder.
Run from the site root: python3 tools/check_llms.py"""
import re, os, sys

text = open('llms.txt', encoding='utf-8').read()
lines = text.splitlines()
errors = []
if not lines or not lines[0].startswith('# '):
    errors.append('first line must be an H1 title')
if not any(l.startswith('> ') for l in lines[:4]):
    errors.append('a blockquote summary must follow the title')
if '## When to use' not in lines:
    errors.append('missing "## When to use" section')
for url in re.findall(r'\]\((https://www\.vinayswaminathan\.com/[^)]*)\)', text):
    path = url.split('vinayswaminathan.com/', 1)[1] or 'index.html'
    if not os.path.isfile(path):
        errors.append(f'link has no file in the site: {url}')
print('\n'.join(errors) or 'llms.txt OK')
sys.exit(1 if errors else 0)
