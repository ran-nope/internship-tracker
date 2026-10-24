"""Redacted, dependency-free checks of the current tracked/proposed source tree.

This is a guard against common mistakes, not an exhaustive secret detector or a
Git-history audit. Never print matched values, source lines, or environment data.
"""
import hashlib
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),
    'GitHub token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
    'AWS access key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'Slack token': re.compile(rb'\bxox[baprs]-[A-Za-z0-9-]{20,}\b'),
    'JWT literal': re.compile(rb'\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'),
    'database URL credentials': re.compile(rb'(?:postgres(?:ql)?|mysql)://[^\s:/]+:([^\s@]+)@', re.I),
    'literal secret assignment': re.compile(
        rb'''(?im)^\s*(?:(?:export\s+)?(?:const|let|var)\s+)?["']?(?:SECRET_KEY|API_KEY|ACCESS_TOKEN|PRIVATE_KEY|PASSWORD)["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']'''
    ),
}
# Exact values and paths only. No blanket exclusions for tests or documentation.
TEST_LITERALS = {
    ('tests/test_api.py', b'isolated-test-secret-not-for-production'),
    ('frontend/e2e/phase1.spec.mjs', b'isolated-browser-test-password'),
    ('frontend/e2e/phase2.spec.mjs', b'isolated-phase2-browser-password'),
    ('frontend/e2e/public.spec.mjs', b'isolated-public-navigation-password'),
}
FIXTURE_HASH = '72a3f4498f60e59216ce1906dba16840215c781a39db6baed6553fb2caf795ce'


def candidates():
    raw = subprocess.check_output(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT,
    )
    return sorted(set(name for name in raw.decode().split('\0') if name))


def findings(name, data):
    path = Path(name)
    sensitive = (
        (path.name.startswith('.env') and path.name != '.env.example')
        or path.suffix.lower() in {'.pem', '.key', '.db', '.sqlite', '.sqlite3', '.dump'}
        or path.name in {'id_rsa', 'id_ed25519', '.npmrc', '.pypirc'}
        or any(part in {'.aws', '.vercel', 'venv', '.venv', 'node_modules', 'dist', 'test-results', 'backups', 'dumps'} for part in path.parts)
    )
    if sensitive:
        yield 1, 'sensitive/generated file'
    for rule, pattern in PATTERNS.items():
        for match in pattern.finditer(data):
            if rule == 'database URL credentials' and match.group(1) in {b'PASSWORD', b'<PASSWORD>'}:
                continue
            if rule == 'literal secret assignment':
                value = match.group(1)
                if (name, value) in TEST_LITERALS:
                    continue
                if name.endswith('.env.example') and value.startswith(b'replace-with-'):
                    continue
            if (rule == 'JWT literal' and name == 'tests/fixtures/legacy_hs256.json'
                    and hashlib.sha256(match.group()).hexdigest() == FIXTURE_HASH):
                continue
            yield data[:match.start()].count(b'\n') + 1, rule


def main():
    count = 0
    errors = []
    for name in candidates():
        path = ROOT / name
        if not path.is_file():
            continue  # Locally removed files before staging.
        if path.is_symlink():
            errors.append((name, 1, 'symlink requires manual review'))
            continue
        count += 1
        errors.extend((name, line, rule) for line, rule in findings(name, path.read_bytes()))
    for name, line, rule in errors:
        print(f'{name}:{line}: {rule} (value redacted)', file=sys.stderr)
    if errors:
        print(f'Secret/sensitive-file check failed: {len(errors)} findings. Values were not printed.', file=sys.stderr)
        return 1
    print(f'Secret/sensitive-file check passed for {count} current source files. Git history was not scanned.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
