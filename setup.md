# Setup

## 1. Install Bob configuration

Run the installer from the repo root:

```sh
./install.sh [TARGET_DIR]
```

`TARGET_DIR` defaults to `~/.bob`. Pass a different path to install elsewhere.

What the installer does:

- Copies all skills from `bob/skills/` into `<TARGET>/skills/` (existing skill directories are updated in-place)
- Merges custom modes from `bob/settings/custom_modes.yaml` into `<TARGET>/settings/custom_modes.yaml` — adds modes by slug, skips slugs already present
- Writes `bob/rules/communication-style.md` into `<TARGET>/rules/`

**Requires:** [`yq` v4](https://github.com/mikefarah/yq) for the mode merge step.

### mcp.json (manual)

`mcp.json` is intentionally excluded from the installer because it contains machine-specific paths and API keys. Merge it manually:

```sh
# view what ratchet adds
cat bob/settings/mcp.json

# then edit your existing file
$EDITOR ~/.bob/settings/mcp.json
```

Update entries where indicated (e.g. replace `"add your own"` in the Tavily entry with a real API key).

### codegraph index (per project)

The `codegraph` MCP entry needs the `codegraph` binary on `PATH`. The server entry is global — `serve --mcp` takes the project root from the MCP client's `rootUri`, so it does not need a per-project `--path`.

The **index** is per repository. Run once in each project you work in:

```sh
cd /path/to/project
codegraph init
```

This creates `.codegraph/` (add it to `.gitignore`). Without it, codegraph tools report that the project is not initialized, and the Research mode falls back to reading files directly.
