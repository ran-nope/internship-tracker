"""Check local Markdown/HTML links and heading anchors without network access."""
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def anchors(source):
    used = {}
    result = set()
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', source, re.M):
        slug = re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')
        suffix = used.get(slug, 0)
        used[slug] = suffix + 1
        result.add(f'{slug}-{suffix}' if suffix else slug)
    result.update(re.findall(r'\bid=["\']([^"\']+)["\']', source))
    return result


def main():
    raw = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT)
    names = sorted(set(name for name in raw.decode().split('\0') if name.endswith('.md')))
    errors = []
    checked = 0
    for name in names:
        file = ROOT / name
        if not file.is_file():
            continue
        source = re.sub(r'```.*?```', '', file.read_text(), flags=re.S)
        links = re.findall(r'\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)', source)
        links += re.findall(r'\b(?:href|src)=["\']([^"\']+)["\']', source)
        for link in links:
            parsed = urlsplit(link.strip('<>'))
            if parsed.scheme or parsed.netloc:
                continue
            target = (file.parent / unquote(parsed.path)).resolve() if parsed.path else file
            checked += 1
            if not target.is_relative_to(ROOT) or not target.exists():
                errors.append(f'{name}: missing or out-of-repository target {link}')
            elif parsed.fragment and target.suffix == '.md':
                if unquote(parsed.fragment) not in anchors(target.read_text()):
                    errors.append(f'{name}: missing anchor {link}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'Documentation check passed: {checked} local links/anchors. External links are not checked by this script.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
