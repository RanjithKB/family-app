#!/bin/sh
# Fails if a file would publish someone's private setup or a secret key.
#   staged mode (pre-commit hook):  sh scripts/check-secrets.sh --staged
#   repo mode (CI, or by hand):     sh scripts/check-secrets.sh
mode=${1:-all}
fail=0
say() { echo "check-secrets: $1"; fail=1; }

if [ "$mode" = "--staged" ]; then
  files=$(git diff --cached --name-only --diff-filter=ACMR)
  read_file() { git show ":$1" 2>/dev/null; }
else
  files=$(git ls-files)
  read_file() { cat "$1" 2>/dev/null; }
fi

# Files that must never be in the repo at all.
for f in $files; do
  case "$f" in
    supabase/members.sql|.env|.env.*|*.pem|*.key|*.p12|*service-account*.json|.claude/settings.local.json)
      say "$f must not be committed (it holds your own setup or a key)." ;;
  esac
done

for f in $files; do
  case "$f" in *.png|*.jpg|*.jpeg|*.webp|*.ico|scripts/check-secrets.sh) continue ;; esac
  body=$(read_file "$f") || continue

  # Server-side keys: these bypass all security rules. Never needed in this app.
  echo "$body" | grep -Eq "sb_secret_[A-Za-z0-9_-]{10,}" && say "$f contains a Supabase secret key (sb_secret_...)."
  echo "$body" | grep -Eq "GOCSPX-[A-Za-z0-9_-]{10,}" && say "$f contains a Google OAuth client secret (GOCSPX-...)."
  echo "$body" | grep -Eq "BEGIN [A-Z ]*PRIVATE KEY" && say "$f contains a private key."
  echo "$body" | grep -Eq "(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}" && say "$f contains a GitHub token."
  # Supabase JWT keys: the anon key is public-safe but personal; service_role is a full admin key.
  for jwt in $(echo "$body" | grep -Eo "eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+"); do
    payload=$(echo "$jwt" | cut -d. -f2 | tr '_-' '/+')
    while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    if echo "$payload" | base64 -d 2>/dev/null | grep -q service_role; then
      say "$f contains a Supabase service_role key. Rotate it in Supabase now."
    else
      say "$f contains a Supabase key (JWT). Keep your real keys out of the repo."
    fi
  done

  # Real emails in code or SQL (placeholders and noreply addresses are fine).
  case "$f" in *.js|*.sql|*.html|*.json|*.webmanifest)
    bad=$(echo "$body" | grep -Eo "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" \
      | grep -Evi "^(you|spouse)@(gmail|example)\.com$|noreply|@example\.(com|org)$" | sort -u)
    [ -n "$bad" ] && say "$f contains a real-looking email: $(echo $bad)" ;;
  esac
done

# Your own Supabase connection in config.js.
cfg=$(read_file js/config.js)
if echo "$files" | grep -qx "js/config.js" && [ -n "$cfg" ]; then
  echo "$cfg" | grep -Eq "DEMO_MODE:[[:space:]]*false" && say "js/config.js has DEMO_MODE: false."
  echo "$cfg" | grep -Eq "SUPABASE_URL:[[:space:]]*'https://[^']+'" && ! echo "$cfg" | grep -q "YOUR-PROJECT" \
    && say "js/config.js has a real SUPABASE_URL."
  echo "$cfg" | grep -Eq "SUPABASE_ANON_KEY:[[:space:]]*'[^']+'" && ! echo "$cfg" | grep -q "YOUR-ANON-PUBLIC-KEY" \
    && say "js/config.js has a real SUPABASE_ANON_KEY."
fi

if [ $fail -ne 0 ]; then
  echo
  echo "Keep your real values only in the folder you upload to Cloudflare."
  echo "Unstage a file with: git restore --staged <file>"
  exit 1
fi
echo "check-secrets: ok"
