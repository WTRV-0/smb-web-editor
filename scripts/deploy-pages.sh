#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (classic GitHub Pages).
# Used instead of an Actions workflow because pushing workflow files needs the
# `workflow` OAuth scope; this only needs `repo`.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
touch dist/.nojekyll

REMOTE_URL=$(git remote get-url origin)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp -r dist/. "$TMP"/
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@local" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f "$REMOTE_URL" gh-pages
echo "Published gh-pages."
