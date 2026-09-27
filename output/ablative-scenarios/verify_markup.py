"""Offline markup/link checks; no browser execution or network requests."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'builds/ablative-material-testing-fixture.html'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.links, self.ids, self.refs = [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in a:
            self.ids.append(a['id'])
        for attr in ['aria-labelledby', 'aria-describedby']:
            self.refs.extend(a.get(attr, '').split())
        for attr in ['href', 'src']:
            if a.get(attr):
                self.links.append(a[attr])

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        assert self.stack and self.stack[-1] == tag, f'Unbalanced HTML: {tag}, stack {self.stack[-5:]}'
        self.stack.pop()

check = Check()
check.feed(PAGE.read_text())
assert not check.stack, check.stack
assert all(n == 1 for n in Counter(check.ids).values()), 'Duplicate IDs'
assert all(ref in check.ids for ref in check.refs), 'Dangling ARIA reference'
verified = 0
for link in check.links:
    url = urlsplit(link)
    if url.scheme or url.netloc:
        continue
    if url.path:
        p = ROOT / unquote(url.path.lstrip('/')) if url.path.startswith('/') else PAGE.parent / unquote(url.path)
        assert p.exists(), f'Missing file: {link}'
        verified += 1
    elif url.fragment:
        assert url.fragment in check.ids, f'Missing anchor: {link}'
print(f'PASS: balanced HTML, unique IDs, ARIA references and {verified} local resource links.')
