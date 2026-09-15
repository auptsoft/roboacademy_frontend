#!/bin/sh
cat > /usr/share/nginx/html/env.js << EOF
window.__env__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_PLATFORM_TENANT_ID: "${VITE_PLATFORM_TENANT_ID:-}",
  VITE_BOTNOVA_API_BASE_URL: "${VITE_BOTNOVA_API_BASE_URL:-}",
  VITE_BOTNOVA_WS_URL: "${VITE_BOTNOVA_WS_URL:-}",
  VITE_BOTNOVA_EMBED_ORIGIN: "${VITE_BOTNOVA_EMBED_ORIGIN:-}"
};
EOF
exec nginx -g "daemon off;"
