#!/usr/bin/env bash
set -euo pipefail

WEBAPP_URL="${WEBAPP_URL:-https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${1:-$SCRIPT_DIR/a01-request.json}"
HEADER_FILE="$(mktemp)"
BODY_FILE="$(mktemp)"
trap 'rm -f "$HEADER_FILE" "$BODY_FILE"' EXIT

if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "Payload file not found: $PAYLOAD_FILE" >&2
  exit 1
fi

if [ -n "${GOOGLE_ACCESS_TOKEN:-}" ]; then
  HTTP_STATUS="$(curl --silent --show-error --location \
    --output "$BODY_FILE" \
    --dump-header "$HEADER_FILE" \
    --write-out "%{http_code}" \
    --request POST "$WEBAPP_URL" \
    --header "Content-Type: application/json" \
    --header "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
    --data-binary "@$PAYLOAD_FILE")"
else
  HTTP_STATUS="$(curl --silent --show-error --location \
    --output "$BODY_FILE" \
    --dump-header "$HEADER_FILE" \
    --write-out "%{http_code}" \
    --request POST "$WEBAPP_URL" \
    --header "Content-Type: application/json" \
    --data-binary "@$PAYLOAD_FILE")"
fi

CONTENT_TYPE="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print $2; exit}' "$HEADER_FILE" | tr -d '\r')"

if [[ "$CONTENT_TYPE" != application/json* ]]; then
  echo "Request failed: expected JSON but received $CONTENT_TYPE (HTTP $HTTP_STATUS)." >&2
  echo "This usually means the Web App deployment is not accessible to this API caller." >&2
  echo "Set Web App access to Anyone, or pass GOOGLE_ACCESS_TOKEN for a Google-authorized call." >&2
  exit 1
fi

cat "$BODY_FILE"
echo

if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
  exit 1
fi
