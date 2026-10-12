#!/bin/sh
cat > /usr/share/nginx/html/env.js << EOF
window.__env__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_PLATFORM_TENANT_ID: "${VITE_PLATFORM_TENANT_ID:-}",
  VITE_PLATFORM_HOSTS: "${VITE_PLATFORM_HOSTS:-}"
};
EOF
exec nginx -g "daemon off;"
