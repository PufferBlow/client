#!/usr/bin/env bash

set -euo pipefail

required_major=20

current_major=0
if command -v node >/dev/null 2>&1; then
  current_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0')"
fi

if [ "${current_major}" -lt "${required_major}" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  unset npm_config_prefix
  unset NPM_CONFIG_PREFIX

  if [ ! -s "${NVM_DIR}/nvm.sh" ]; then
    printf 'Node %s+ is required, and nvm was not found at %s.\n' "${required_major}" "${NVM_DIR}" >&2
    exit 1
  fi

  # Load nvm only when the active shell is still on an older Node.
  . "${NVM_DIR}/nvm.sh"
  nvm use --silent "${required_major}" >/dev/null
fi

exec node "$@"
