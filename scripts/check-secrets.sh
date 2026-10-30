#!/bin/sh
# Cheap pre-publish scan for committed credentials. Not a substitute for a real scanner on git history
# (try: gitleaks detect), but it catches the usual mistakes.
cd "$(dirname "$0")/.." || exit 1
hits=$(grep -rEn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude=pnpm-lock.yaml --exclude=.env.example --exclude=check-secrets.sh \
  -e 'AIza[0-9A-Za-z_-]{35}' -e 'sk-[A-Za-z0-9]{20,}' -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e '(YOUCAM|GEMINI)_API_KEY=[A-Za-z0-9._-]{16,}' -e 'Bearer [A-Za-z0-9._-]{24,}' . 2>/dev/null)
if [ -n "$hits" ]; then echo "Possible secrets found:"; echo "$hits"; exit 1; fi
[ -f .env ] && echo "note: .env exists locally (it is gitignored; make sure it is not committed)"
echo "No credential patterns found."
