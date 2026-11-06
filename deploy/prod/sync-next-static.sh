#!/bin/sh
# Copies the running frontend's built scripts/styles (and their .br/.gz) to data/next, where the
# proxy hands them out already compressed. Run after every frontend deploy. Older builds' files are
# kept (a page opened before the deploy still asks for them); files not part of a sync for 30 days
# are dropped. The copied files are stamped now: they keep their build date otherwise, and a re-run
# long after a build must never age out the files of the build that is running.
set -e
cd "$(dirname "$0")"
mkdir -p data/next/_next/static
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
docker cp bordino-lottery-front-1:/app/.next/static/. "$tmp/"
find "$tmp" -type f -exec touch {} +
cp -a "$tmp/." data/next/_next/static/
find data/next/_next/static -type f -mtime +30 -delete 2>/dev/null || true
echo "synced: $(find data/next/_next/static -type f | wc -l) files, $(du -sh data/next | cut -f1)"
