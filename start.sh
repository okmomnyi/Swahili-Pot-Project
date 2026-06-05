#!/usr/bin/env bash
# Start SwahiliPot IMS (backend + frontend) for development.
#   Usage:  ./start.sh    (or:  bash start.sh)
# First time?  npm run install:all
cd "$(dirname "$0")" || exit 1
exec node start.js
