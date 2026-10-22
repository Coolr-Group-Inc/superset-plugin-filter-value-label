# plugin-filter-value-label

A custom Superset native filter that supports separate value and display label columns.

**Based on** the Apache Superset native filter Select plugin (`src/filters/components/Select`).

## What it does

In the filter configuration modal, two column selectors appear under the **Query** section:

| Control | Role | Required |
|---|---|---|
| **Column** | The value used for filtering charts | Yes |
| **Display Column** | Values shown as labels in the dropdown | No |

When **Display Column** is set, the filter dropdown shows labels from that column while applying filters on **Column** values. The active-filter chip in the filter bar also shows the display label instead of the raw value.

**Example**: filter on `customer_id` (integer) but show `customer_name` in the dropdown.

## Superset compatibility

This plugin targets current Superset releases where the native filter configuration supports column-select controls directly. The upstream `isColumnSelect: true` behavior introduced in Apache Superset makes this plugin compatible without a custom frontend patch.

The `displayColumn` control in this plugin is declared with `isColumnSelect: true`, which tells the native filter config modal to render a dataset column selector and store the selected value in `controlValues`. This is the built-in mechanism Superset exposes for plugin authors and does not require patching the core frontend for modern Docker or standard-release installs.

---

## Option A — Build a Docker image from source

Use this when you control the full build pipeline or need backend changes alongside the plugin.

### Prerequisites

- Docker and Docker Compose
- A clone of this Superset repository

### Steps

#### 1. Install the plugin

```bash
cd superset-frontend
npm install @coolr/plugin-filter-value-label
```

#### 2. Register the plugin

Add to `src/setup/setupPlugins.ts`:

```ts
import SelectFilterPlugin from '@coolr/plugin-filter-value-label';
// ...
new SelectFilterPlugin().configure({ key: 'filter_value_label' }).register();
```

#### 3. Build the frontend

```bash
npm run build
# Output: ../superset/static/assets/
```

#### 4. Build and run the Docker image

```bash
# From the repository root
docker build --target lean -t my-org/superset:custom -f Dockerfile .
docker compose -f docker-compose-non-dev.yml up -d
```

### Rebuilding after plugin changes

Re-run steps 3 and 4 whenever plugin source files change.

---

## Option B — Patch an existing Docker image (faster)

Use this when you already run an official `apache/superset` image and want to add the plugin without rebuilding Python dependencies, system packages, or the backend.

### How it works

Superset's frontend compiles to static files in `superset/static/assets/`. Replacing those files in the existing image with a freshly compiled set that includes the plugin is all that is needed.

### Steps

#### 1. Install the plugin

```bash
cd superset-frontend
npm install @coolr/plugin-filter-value-label
```

#### 2. Register the plugin

Add to `src/setup/setupPlugins.ts`:

```ts
import SelectFilterPlugin from '@coolr/plugin-filter-value-label';
// ...
new SelectFilterPlugin().configure({ key: 'filter_value_label' }).register();
```

#### 3. Compile the frontend

```bash
npm run build
# Output: ../superset/static/assets/
```

#### 4. Create a thin Dockerfile

Create `Dockerfile.patch` at the repository root:

```dockerfile
FROM apache/superset:4.1.0   # replace with your running image tag

# Replace the pre-built frontend assets with the locally compiled ones
# that include the plugin.
COPY --chown=superset:superset superset/static/assets/ /app/superset/static/assets/
```

#### 5. Build and run the patched image

```bash
docker build -f Dockerfile.patch -t my-org/superset:4.1.0-custom .

# Update the image tag in your docker-compose.yml, then:
docker compose up -d
```

### Option A vs Option B

| | Option A (full build) | Option B (patch existing image) |
|---|---|---|
| Build time | ~20–40 min | ~3 min (frontend only) |
| Base image | Built from source | Official release |
| Backend/Python changes | Supported | Not possible |
| Recommended for | Full control of the stack | Plugin-only changes |

---

## Development (hot-reload, no Docker)

```bash
# Terminal 1 – backend
superset run -p 8088 --with-threads --reload

# Terminal 2 – frontend dev server with HMR
cd superset-frontend
npm run dev
```

Browse to `http://localhost:9000`. The plugin is automatically included because `setupPlugins.ts` already imports it.
