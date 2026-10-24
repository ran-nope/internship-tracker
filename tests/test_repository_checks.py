"""Regression checks for CI safeguards; uses synthetic values only."""
import json
from pathlib import Path
import unittest

from scripts.check_docs import anchors
from scripts.check_secrets import findings


class RepositoryChecks(unittest.TestCase):
    def test_common_secret_patterns_are_reported_without_values(self):
        samples = [
            b'ghp_' + b'A' * 36,
            b'AKIA' + b'B' * 16,
            b'-----BEGIN ' + b'PRIVATE KEY-----',
            b'postgresql://demo:' + b'synthetic-only@localhost/db',
            b'SECRET_KEY = "' + b'synthetic-unapproved-value"',
        ]
        for index, value in enumerate(samples):
            with self.subTest(case=index):
                results = list(findings('example.py', value))
                self.assertTrue(results)
                self.assertNotIn(value.decode(), repr(results))

    def test_only_exact_documented_test_values_are_allowed(self):
        token = json.loads((Path(__file__).parent / 'fixtures/legacy_hs256.json').read_text())['token'].encode()
        self.assertEqual(list(findings('tests/fixtures/legacy_hs256.json', token)), [])
        self.assertTrue(list(findings('other.json', token)))
        self.assertTrue(list(findings('tests/fixtures/legacy_hs256.json', token[:-1] + b'A')))
        value = b"SECRET_KEY = 'isolated-test-secret-not-for-production'"
        self.assertEqual(list(findings('tests/test_api.py', value)), [])
        self.assertTrue(list(findings('main.py', value)))

    def test_sensitive_files_are_reported_even_with_empty_contents(self):
        for name in ['.env', 'frontend/.env.local', 'local.sqlite3', '.aws/credentials', 'backups/database.sql']:
            with self.subTest(path=name):
                self.assertTrue(list(findings(name, b'')))
        self.assertEqual(list(findings('.env.example', b'DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE')), [])

    def test_documentation_heading_anchors(self):
        self.assertEqual(anchors('# Setup\n## Setup\n## Limits and tradeoffs\n'), {'setup', 'setup-1', 'limits-and-tradeoffs'})
