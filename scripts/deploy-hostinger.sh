#!/usr/bin/env bash
# Package the Wizards hub for Hostinger Node.js web-app hosting.
#
#   npm run deploy              zip WITH data/ (Hostinger replaces the app folder)
#   npm run deploy:code         zip without data/ (site 500s unless you restore data/)
#   npm run deploy:fresh        same as deploy — includes data/
#   ./scripts/deploy-hostinger.sh --upload   also FTP the zip if env is set
#
# Optional FTP (do not commit these):
#   HOSTINGER_FTP_HOST=ftp.yourdomain.com
#   HOSTINGER_FTP_USER=u123456789
#   HOSTINGER_FTP_PASS=secret
#   HOSTINGER_FTP_DIR=/          remote folder for the zip (default /)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
STAGING="$DIST/hostinger"
ZIP="$DIST/wizards-hostinger.zip"
INCLUDE_DATA=1
UPLOAD=0

for arg in "$@"; do
  case "$arg" in
    --with-data) INCLUDE_DATA=1 ;;
    --skip-data) INCLUDE_DATA=0 ;;
    --upload) UPLOAD=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
  esac
done

rm -rf "$STAGING" "$ZIP"
mkdir -p "$STAGING/public"

cp "$ROOT/server.js" "$ROOT/store.js" "$ROOT/accounts.js" "$ROOT/package.json" "$ROOT/package-lock.json" "$STAGING/"
rsync -a --exclude '.DS_Store' "$ROOT/public/" "$STAGING/public/"

if [[ "$INCLUDE_DATA" -eq 1 ]]; then
  mkdir -p "$STAGING/data"
  rsync -a --exclude '.DS_Store' "$ROOT/data/" "$STAGING/data/"
else
  echo "WARNING: Skipping data/. Hostinger replaces the app folder, so a zip"
  echo "without data/ deletes live JSON and /api/roster will 500."
fi

(
  cd "$STAGING"
  zip -qry "$ZIP" .
)

BYTES="$(wc -c < "$ZIP" | tr -d ' ')"
echo
echo "Packed $ZIP ($BYTES bytes)"
echo
echo "Hostinger steps"
echo "  1. hPanel → Websites → Add Website → Node.js web app"
echo "     (or Redeploy if the site already exists)"
echo "  2. Source: File upload → pick wizards-hostinger.zip"
echo "  3. Confirm these settings:"
echo "       Application type   express"
echo "       Node.js version    20 or 22"
echo "       Build script       (leave empty)"
echo "       Entry file         server.js"
echo "       Package manager    npm"
echo "  4. Deploy, then open the domain. Team password is still pineapple."
echo
echo "This is not a static PHP drop. The APIs need Hostinger Node.js hosting."
echo "Do not upload node_modules; Hostinger runs npm install."

if [[ "$UPLOAD" -eq 1 ]]; then
  : "${HOSTINGER_FTP_HOST:?Set HOSTINGER_FTP_HOST}"
  : "${HOSTINGER_FTP_USER:?Set HOSTINGER_FTP_USER}"
  : "${HOSTINGER_FTP_PASS:?Set HOSTINGER_FTP_PASS}"
  REMOTE_DIR="${HOSTINGER_FTP_DIR:-/}"
  echo
  echo "Uploading zip to $HOSTINGER_FTP_HOST$REMOTE_DIR ..."
  curl --fail --silent --show-error \
    --user "$HOSTINGER_FTP_USER:$HOSTINGER_FTP_PASS" \
    --ftp-create-dirs \
    --upload-file "$ZIP" \
    "ftp://$HOSTINGER_FTP_HOST${REMOTE_DIR%/}/wizards-hostinger.zip"
  echo "FTP upload finished."
fi
