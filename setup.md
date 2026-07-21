# Setup

## 1. Merge Bob configuration into your `.bob` directory

The `bob/` directory in this repo mirrors the structure of the `.bob` directory Bob reads from your home folder (`~/.bob`). Copy or merge the contents:

```sh
cp -r bob/rules/*    ~/.bob/rules/
cp -r bob/skills/*   ~/.bob/skills/
cp -r bob/.ratchet   ~/.bob/.ratchet
cp    bob/settings/mcp.json          ~/.bob/settings/mcp.json
cp    bob/settings/custom_modes.yaml ~/.bob/settings/custom_modes.yaml
```

If you already have existing files in `~/.bob/settings/`, merge manually rather than overwriting — particularly `mcp.json` and `custom_modes.yaml`.

Update `mcp.json` with your own credentials where indicated (e.g. replace `"add your own"` in the Tavily entry with a real API key).

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
