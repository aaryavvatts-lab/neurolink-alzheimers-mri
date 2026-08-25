#!/usr/bin/env bash
# Everything that has to pass before this is worth pushing.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== python syntax and imports"
.venv/bin/python -c "
import ast, pathlib, importlib
bad = []
for f in pathlib.Path('src').rglob('*.py'):
    try: ast.parse(f.read_text())
    except SyntaxError as e: bad.append((str(f), e.lineno))
assert not bad, bad
import src.neurolink.report, src.neurolink.train, src.neurolink.evaluate
import src.neurolink.explain, src.neurolink.export_onnx, src.neurolink.export_volumes
print('   ok')"

echo "== results file is strict JSON, no NaN"
.venv/bin/python -c "
import json
for p in ['reports/results.json', 'web/data/results.json', 'web/public/results.json']:
    json.load(open(p), parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))
print('   ok')"

echo "== no em dashes in anything a reader sees"
! grep -rn --binary-files=without-match --exclude-dir=__pycache__ '—' \
    README.md src web/app web/components web/lib 2>/dev/null || {
  echo '   found em dashes'; exit 1; }
echo "   ok"

echo "== typescript"
cd web && npx tsc --noEmit && echo "   ok"

echo "== browser preprocessing still matches python"
npm test --silent

echo "== site builds"
npm run build >/dev/null && echo "   ok"

echo
echo "All checks passed."
