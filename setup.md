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

## 2. Run SearXNG as a user systemd service (Linux)

The SearXNG MCP server expects a local SearXNG instance at `http://localhost:58080`. The `searxng/` directory contains a Docker Compose stack. On Linux, run it as a user-level systemd service so it starts automatically without root.

**a. Create the service file:**

```sh
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/searxng.service << 'EOF'
[Unit]
Description=SearXNG local search instance
After=default.target

[Service]
Type=simple
WorkingDirectory=%h/path/to/bob-pack/searxng
ExecStart=docker compose up
ExecStop=docker compose down
Restart=on-failure

[Install]
WantedBy=default.target
EOF
```

Replace `%h/path/to/bob-pack/searxng` with the absolute path to the `searxng/` directory in this repo (e.g. `/home/youruser/develop/bob-pack/searxng`).

**b. Enable and start the service:**

```sh
systemctl --user daemon-reload
systemctl --user enable --now searxng.service
```

**c. Verify it is running:**

```sh
systemctl --user status searxng.service
curl -s http://localhost:58080 | head -5
```

> **Note:** User systemd services require lingering to start without an active login session. Enable it once with:
> ```sh
> loginctl enable-linger $USER
> ```
