#!/usr/bin/env bash
# deploy-superset-610.sh
# Deploys Superset 6.1.0 with the filter-value-label plugin.
# Run as root on the production server.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SUPERSET_DIR="/opt/superset-610"
PLUGIN_DIR="/opt/superset-plugin-filter-value-label"
OLD_DIR="/opt/superset"
SUPERSET_TAG="6.1.0"
PROJECT="superset"
COMPOSE="$SUPERSET_DIR/docker-compose-non-dev.yml"
OLD_COMPOSE="$OLD_DIR/docker-compose-prod-6.yml"

# ── Helpers ───────────────────────────────────────────────────────────────────
step() { printf '\n\033[1;34m▶  %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔  %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✖  %s\033[0m\n' "$*"; exit 1; }

[ "$(whoami)" = "root" ] || die "Run as root"
command -v docker >/dev/null || die "Docker not found"
command -v git    >/dev/null || die "git not found"
command -v python3>/dev/null || die "python3 not found"

# ── 1. Clone Superset ─────────────────────────────────────────────────────────
step "Cloning Superset $SUPERSET_TAG → $SUPERSET_DIR"
rm -rf "$SUPERSET_DIR"
git clone --depth 1 --branch "$SUPERSET_TAG" \
    https://github.com/apache/superset.git "$SUPERSET_DIR"
ok "Superset cloned"

# ── 2. Clone plugin ───────────────────────────────────────────────────────────
if [ -d "$PLUGIN_DIR" ]; then
    step "Plugin already exists at $PLUGIN_DIR — skipping clone"
    ok "Using existing plugin"
else
    step "Cloning plugin → $PLUGIN_DIR"
    git clone https://github.com/Coolr-Group-Inc/superset-plugin-filter-value-label.git \
        "$PLUGIN_DIR"
    ok "Plugin cloned"
fi

# ── 3. Apply isColumnSelect patch ─────────────────────────────────────────────
step "Applying superset-isColumnSelect.patch"
cd "$SUPERSET_DIR"
if git apply "$PLUGIN_DIR/superset-isColumnSelect.patch" 2>/dev/null; then
    ok "Patch applied cleanly"
elif git apply --3way "$PLUGIN_DIR/superset-isColumnSelect.patch" 2>/dev/null; then
    ok "Patch applied via 3-way merge"
else
    patch -p1 --fuzz=5 < "$PLUGIN_DIR/superset-isColumnSelect.patch" \
        || die "superset-isColumnSelect.patch failed — check the patch against this Superset version"
    ok "Patch applied with fuzz"
fi

# ── 4. Dockerfile: NODE_OPTIONS + starrocks ───────────────────────────────────
step "Patching Dockerfile"
python3 - "$SUPERSET_DIR/Dockerfile" <<'PY'
import sys
path = sys.argv[1]
content = open(path).read()

old_env = (
    "ENV BUILD_CMD=${NPM_BUILD_CMD} \\\n"
    "    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true"
)
new_env = (
    "# NODE_OPTIONS caps heap so TerserPlugin does not OOM in memory-constrained Docker builds\n"
    "ARG NODE_OPTIONS=\"--max-old-space-size=4096\"\n"
    "ENV BUILD_CMD=${NPM_BUILD_CMD} \\\n"
    "    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \\\n"
    "    NODE_OPTIONS=${NODE_OPTIONS}"
)
if "NODE_OPTIONS" not in content:
    if old_env in content:
        content = content.replace(old_env, new_env)
    else:
        sys.exit("ERROR: cannot find ENV BUILD_CMD block in Dockerfile")

content = content.replace(
    "uv pip install .[postgres]",
    "uv pip install .[postgres,starrocks]"
)
open(path, "w").write(content)
print("  Dockerfile patched")
PY
ok "Dockerfile patched"

# ── 5. docker-bootstrap.sh: force-reinstall ───────────────────────────────────
step "Patching docker/docker-bootstrap.sh"
python3 - "$SUPERSET_DIR/docker/docker-bootstrap.sh" <<'PY'
import sys
path = sys.argv[1]
content = open(path).read()
old = (
    "  if command -v uv > /dev/null 2>&1; then\n"
    "    uv pip install --no-cache-dir -r \"${REQUIREMENTS_LOCAL}\"\n"
    "  else\n"
    "    pip install --no-cache-dir -r \"${REQUIREMENTS_LOCAL}\"\n"
    "  fi"
)
new = "  pip install --no-cache-dir --force-reinstall -r \"${REQUIREMENTS_LOCAL}\""
if old in content:
    content = content.replace(old, new)
else:
    print("  WARNING: expected uv/pip block not found — docker-bootstrap.sh may already be patched")
open(path, "w").write(content)
print("  docker-bootstrap.sh patched")
PY
ok "docker-bootstrap.sh patched"

# ── 6. useFilterOperations.ts: ALLOW_DEPENDENCIES ────────────────────────────
step "Patching useFilterOperations.ts (ALLOW_DEPENDENCIES)"
FILTER_OPS="$SUPERSET_DIR/superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/hooks/useFilterOperations.ts"
python3 - "$FILTER_OPS" <<'PY'
import sys
path = sys.argv[1]
content = open(path).read()
if "'filter_value_label'" not in content:
    content = content.replace(
        "  'filter_time',",
        "  'filter_time',\n  'filter_value_label',"
    )
open(path, "w").write(content)
print("  ALLOW_DEPENDENCIES patched")
PY
ok "ALLOW_DEPENDENCIES patched"

# ── 7. Copy plugin source ─────────────────────────────────────────────────────
step "Copying plugin source into Superset frontend"
mkdir -p "$SUPERSET_DIR/superset-frontend/plugins/plugin-filter-value-label"
cp -r "$PLUGIN_DIR/src" \
    "$SUPERSET_DIR/superset-frontend/plugins/plugin-filter-value-label/"
ok "Plugin source copied"

# ── 8. Register plugin in setupPlugins.ts ─────────────────────────────────────
step "Registering plugin in setupPlugins.ts"
SETUP="$SUPERSET_DIR/superset-frontend/src/setup/setupPlugins.ts"
python3 - "$SETUP" <<'PY'
import sys
path = sys.argv[1]
content = open(path).read()
IMPORT   = "import FilterSelectPlugin from '../../plugins/plugin-filter-value-label/src/index';"
REGISTER = "  new FilterSelectPlugin().configure({ key: 'filter_value_label' }).register();"
if IMPORT not in content:
    content = content.replace(
        "import setupPluginsExtra from './setupPluginsExtra';",
        "import setupPluginsExtra from './setupPluginsExtra';\n" + IMPORT
    )
if REGISTER not in content:
    content = content.replace(
        "  new MainPreset().register();",
        "  new MainPreset().register();\n" + REGISTER
    )
open(path, "w").write(content)
print("  setupPlugins.ts patched")
PY
ok "Plugin registered"

# ── 9. Fix postgres version ───────────────────────────────────────────────────
step "Pinning postgres to v16 (existing data compatibility)"
# Use wildcard so the script is robust to future version bumps in compose
sed -i 's/image: postgres:[0-9]*/image: postgres:16/' "$COMPOSE"
ok "Postgres pinned to v16"

# ── 10. Copy server config ─────────────────────────────────────────────────────
step "Copying config from $OLD_DIR"
if [ -f "$OLD_DIR/docker/.env-local" ]; then
    cp "$OLD_DIR/docker/.env-local" "$SUPERSET_DIR/docker/"
    ok ".env-local copied"
else
    warn ".env-local not found in $OLD_DIR/docker/ — skipping"
fi
if [ -d "$OLD_DIR/docker/pythonpath_dev" ]; then
    cp -r "$OLD_DIR/docker/pythonpath_dev" "$SUPERSET_DIR/docker/"
    ok "pythonpath_dev copied"
else
    warn "pythonpath_dev not found in $OLD_DIR/docker/ — skipping"
fi

# ── 10b. Disable example loading ─────────────────────────────────────────────
step "Disabling example data loading"
ENV_LOCAL="$SUPERSET_DIR/docker/.env-local"
if grep -q "SUPERSET_LOAD_EXAMPLES" "$ENV_LOCAL" 2>/dev/null; then
    sed -i 's/^SUPERSET_LOAD_EXAMPLES=.*/SUPERSET_LOAD_EXAMPLES=false/' "$ENV_LOCAL"
else
    echo "SUPERSET_LOAD_EXAMPLES=false" >> "$ENV_LOCAL"
fi
ok "SUPERSET_LOAD_EXAMPLES=false set"

# ── 11. Write requirements-local.txt ─────────────────────────────────────────
step "Writing requirements-local.txt"
cat > "$SUPERSET_DIR/docker/requirements-local.txt" << 'EOF'
# Pin pymysql to version compatible with StarRocks 3.x
pymysql==1.1.2
EOF
ok "requirements-local.txt written"

# ── 12. Build ─────────────────────────────────────────────────────────────────
step "Building Docker image — this takes 15–20 min"
docker compose -p "$PROJECT" -f "$COMPOSE" build
ok "Build complete"

# ── 13. Swap containers ───────────────────────────────────────────────────────
step "Stopping old containers"
if [ -f "$OLD_COMPOSE" ]; then
    docker compose -p "$PROJECT" -f "$OLD_COMPOSE" down 2>/dev/null \
        && ok "Old containers stopped" \
        || warn "Could not stop old containers (may already be down)"
else
    warn "$OLD_COMPOSE not found — skipping old container shutdown"
fi

step "Starting new containers"
docker compose -p "$PROJECT" -f "$COMPOSE" up -d
ok "Containers started"

# ── 14. Wait for superset-init ────────────────────────────────────────────────
step "Waiting for superset-init to complete (max 5 min)"
for i in $(seq 1 60); do
    STATUS=$(docker inspect --format='{{.State.Status}}' superset_init 2>/dev/null || echo "unknown")
    [ "$STATUS" = "exited" ] && break
    printf "."
    sleep 5
done
echo ""

EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' superset_init 2>/dev/null || echo "1")
if [ "$EXIT_CODE" != "0" ]; then
    warn "superset-init failed (exit $EXIT_CODE) — showing last 40 lines:"
    docker logs superset_init --tail=40
    die "Fix the init error above then run: docker exec superset_app superset db upgrade"
fi
ok "superset-init completed"

# ── Done ──────────────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
printf '\n\033[1;32m✅  Superset 6.1.0 is live at http://%s:8088\033[0m\n' "$SERVER_IP"
