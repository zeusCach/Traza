#!/usr/bin/env bash
# Crea la arquitectura de carpetas de TRAZA. Ejecutar desde la raíz del proyecto.
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
  echo "Ejecuta este script desde la raíz del proyecto traza." >&2
  exit 1
fi

# ---------- Rutas (Expo Router, raíz: src/app/) ----------
mkdir -p \
  "src/app/(auth)" \
  "src/app/(tabs)" \
  "src/app/record" \
  "src/app/activity" \
  "src/app/settings"

# ---------- Código fuente (alias @/* -> src/) ----------
mkdir -p \
  "src/components/ui" \
  "src/components/feedback" \
  "src/components/layout" \
  "src/features/onboarding/components" \
  "src/features/auth/components" \
  "src/features/auth/hooks" \
  "src/features/tracking/components" \
  "src/features/tracking/hooks" \
  "src/features/activities/components" \
  "src/features/activities/hooks" \
  "src/features/statistics/components" \
  "src/features/statistics/hooks" \
  "src/features/social/components" \
  "src/features/social/hooks" \
  "src/features/profile/components" \
  "src/features/profile/hooks" \
  "src/hooks" \
  "src/services" \
  "src/stores" \
  "src/database" \
  "src/mocks" \
  "src/theme" \
  "src/types" \
  "src/constants" \
  "src/lib"

# ---------- Marcadores para que Git conserve carpetas vacías ----------
find src -type d -empty -exec touch {}/.gitkeep \;

echo "Arquitectura creada:"
find src -type d | sort
