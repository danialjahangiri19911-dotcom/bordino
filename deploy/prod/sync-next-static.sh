#!/bin/sh
# Copies the running frontend's built scripts/styles (and their .br/.gz) to data/next, where the
# proxy hands them out already compressed. Run after every frontend deploy. Older builds' files are
# kept (a page opened before the deploy still asks for them); files over 30 days old are dropped.
set -e
cd "$(dirname "$0")"
mkdir -p data/next/_next/static
docker cp bordino-lottery-front-1:/app/.next/static/. data/next/_next/static/
find data/next/_next/static -type f -mtime +30 -delete 2>/dev/null || true
echo "synced: $(find data/next/_next/static -type f | wc -l) files, $(du -sh data/next | cut -f1)"
