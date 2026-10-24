"""Manual migration entry point; no .env loading and no stamp-head shortcut."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic import command
from alembic.config import Config
from scripts.schema_preflight import BASELINE, STAGES


def run(operation, target=None):
    config = Config(str(ROOT / 'alembic.ini'))
    config.attributes['operator_operation'] = operation
    if operation == 'baseline':
        if target is not None:
            raise ValueError('Baseline has no target override')
        command.stamp(config, BASELINE)
    elif operation in {'upgrade', 'downgrade'}:
        if target not in STAGES.values():
            raise ValueError('An exact known revision is required; head/base shortcuts are disabled')
        getattr(command, operation)(config, target)
    elif operation == 'current':
        command.current(config)
    elif operation == 'check':
        command.check(config)
    else:
        raise ValueError('Unknown operation')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['upgrade', 'downgrade', 'baseline', 'current', 'check'])
    parser.add_argument('revision', nargs='?', choices=list(STAGES.values()))
    args = parser.parse_args()
    if (args.operation in {'upgrade', 'downgrade'}) != bool(args.revision):
        parser.error('Supply an exact revision only for upgrade/downgrade')
    try:
        run(args.operation, args.revision)
    except Exception:
        print('Migration command stopped. No automatic retry or cleanup was attempted. '
              'Review schema/revision/index state using the runbook; error details suppressed.', file=sys.stderr)
        return 1
    print('Operator command completed; verify the expected schema stage separately.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
