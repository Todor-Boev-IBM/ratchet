#!/usr/bin/env bash
# install.sh — install ratchet bob configuration into a .bob directory
#
# Usage:
#   ./install.sh [TARGET_DIR]
#
# TARGET_DIR defaults to ~/.bob
#
# What this does:
#   1. Copies all skills from bob/skills/ into <TARGET>/skills/
#   2. Merges custom modes from bob/settings/custom_modes.yaml into
#      <TARGET>/settings/custom_modes.yaml (adds modes by slug, skips existing)
#   3. Writes bob/rules/communication-style.md into <TARGET>/rules/
#
# What this does NOT touch:
#   - mcp.json (contains secrets and machine-specific paths — configure manually)
#   - Any existing settings other than custom_modes.yaml

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HOME/.bob}"

echo "==> Installing ratchet bob config into: $TARGET"

# ---------------------------------------------------------------------------
# 1. Skills
# ---------------------------------------------------------------------------
echo ""
echo "--- Skills ---"
mkdir -p "$TARGET/skills"
for skill_dir in "$REPO_DIR/bob/skills"/*/; do
    skill_name="$(basename "$skill_dir")"
    dest="$TARGET/skills/$skill_name"
    if [ -d "$dest" ]; then
        echo "  update  $skill_name"
    else
        echo "  install $skill_name"
    fi
    mkdir -p "$dest"
    cp -r "$skill_dir"* "$dest/"
done

# ---------------------------------------------------------------------------
# 2. Custom modes — merge by slug (add new, skip existing)
# ---------------------------------------------------------------------------
echo ""
echo "--- Custom modes ---"
mkdir -p "$TARGET/settings"
TARGET_MODES="$TARGET/settings/custom_modes.yaml"
SRC_MODES="$REPO_DIR/bob/settings/custom_modes.yaml"

if [ ! -f "$TARGET_MODES" ]; then
    echo "  no existing file — writing fresh copy"
    cp "$SRC_MODES" "$TARGET_MODES"
else
    # Determine which slugs from the source are already present in the target.
    # For each slug in the source that is absent from the target, append it.
    if ! command -v yq &>/dev/null; then
        echo "  ERROR: yq is required for YAML merging but was not found in PATH."
        echo "         Install yq (https://github.com/mikefarah/yq) and re-run, or"
        echo "         merge $SRC_MODES into $TARGET_MODES manually."
        exit 1
    fi

    # Collect slugs already in the target
    mapfile -t existing_slugs < <(yq '.customModes[].slug' "$TARGET_MODES" 2>/dev/null)
    # Read count of modes in the source
    src_count=$(yq '.customModes | length' "$SRC_MODES")

    added=0
    for ((i = 0; i < src_count; i++)); do
        slug=$(yq ".customModes[$i].slug" "$SRC_MODES")
        # Check whether this slug already exists in target
        found=0
        for existing in "${existing_slugs[@]}"; do
            if [ "$existing" = "$slug" ]; then
                found=1
                break
            fi
        done
        if [ "$found" -eq 1 ]; then
            echo "  skip    $slug (already present)"
        else
            echo "  add     $slug"
            # Append the mode block to the target file
            yq ".customModes[$i]" "$SRC_MODES" \
                | yq ". as \$mode | load(\"$TARGET_MODES\") | .customModes += [\$mode]" \
                    - > "${TARGET_MODES}.tmp" && mv "${TARGET_MODES}.tmp" "$TARGET_MODES"
            # Refresh the in-memory list so subsequent iterations see the new slug
            existing_slugs+=("$slug")
            added=$((added + 1))
        fi
    done

    if [ "$added" -eq 0 ]; then
        echo "  nothing to add — all modes already present"
    else
        echo "  added $added mode(s)"
    fi
fi

# ---------------------------------------------------------------------------
# 3. Communication-style rule
# ---------------------------------------------------------------------------
echo ""
echo "--- Rules ---"
mkdir -p "$TARGET/rules"
RULE_SRC="$REPO_DIR/bob/rules/communication-style.md"
RULE_DEST="$TARGET/rules/communication-style.md"

if [ -f "$RULE_DEST" ]; then
    if cmp -s "$RULE_SRC" "$RULE_DEST"; then
        echo "  skip    communication-style.md (identical)"
    else
        echo "  update  communication-style.md"
        cp "$RULE_SRC" "$RULE_DEST"
    fi
else
    echo "  install communication-style.md"
    cp "$RULE_SRC" "$RULE_DEST"
fi

# ---------------------------------------------------------------------------
echo ""
echo "==> Done."
echo ""
echo "Reminder: mcp.json was NOT touched."
echo "  Merge $REPO_DIR/bob/settings/mcp.json into $TARGET/settings/mcp.json manually"
echo "  and fill in your API keys."
