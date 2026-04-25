#!/usr/bin/env bash
# Fetches latest commits from firstsavvy-mobile and updates mobile-sync.md header

REPO="apeterson808/firstsavvy-mobile"
SYNC_FILE="$(dirname "$0")/mobile-sync.md"
API="https://api.github.com/repos/${REPO}/commits?per_page=10"

# Fetch latest 10 commits via GitHub API (no auth needed for public repo)
COMMITS=$(curl -sf "$API" 2>/dev/null)
if [ -z "$COMMITS" ]; then
  exit 0
fi

LATEST_SHA=$(echo "$COMMITS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['sha'][:8])" 2>/dev/null)
LATEST_MSG=$(echo "$COMMITS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['commit']['message'].splitlines()[0])" 2>/dev/null)
LATEST_DATE=$(echo "$COMMITS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['commit']['author']['date'][:10])" 2>/dev/null)

if [ -z "$LATEST_SHA" ]; then
  exit 0
fi

# Update the "Last checked" line and the latest commit note at the top
TODAY=$(date +%Y-%m-%d)
sed -i "s/^\*\*Last checked:\*\*.*/\*\*Last checked:\*\* ${TODAY}  /" "$SYNC_FILE" 2>/dev/null || \
  perl -i -pe "s/^\*\*Last checked:\*\*.*/\*\*Last checked:\*\* ${TODAY}  /" "$SYNC_FILE"

# Append a sync log entry if the latest SHA isn't already recorded
if ! grep -q "$LATEST_SHA" "$SYNC_FILE"; then
  echo "" >> "$SYNC_FILE"
  echo "## Sync Log — ${TODAY}" >> "$SYNC_FILE"
  echo "" >> "$SYNC_FILE"
  echo "Latest mobile commit: \`${LATEST_SHA}\` — ${LATEST_MSG} (${LATEST_DATE})" >> "$SYNC_FILE"
  echo "" >> "$SYNC_FILE"
  echo "**Action required:** Review recent mobile commits at https://github.com/${REPO}/commits/main/ and port any relevant changes to the web app." >> "$SYNC_FILE"
fi
