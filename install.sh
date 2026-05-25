#!/bin/sh
set -eu

REPO_URL="${LAZYWEB_AEO_REPO_URL:-https://github.com/aboul3ata/Lazyweb-aeo-audit-skill.git}"
TARBALL_URL="${LAZYWEB_AEO_TARBALL_URL:-https://github.com/aboul3ata/Lazyweb-aeo-audit-skill/archive/refs/heads/main.tar.gz}"
INSTALL_ROOT="${LAZYWEB_AEO_INSTALL_ROOT:-$HOME/.lazyweb/aeo-audit-skill}"
BIN_DIR="${LAZYWEB_AEO_BIN_DIR:-$HOME/.local/bin}"
SKILL_DIR_NAME="${LAZYWEB_AEO_SKILL_DIR_NAME:-lazyweb-aeo-audit}"
TMP_PARENT="${TMPDIR:-/tmp}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required before installing Lazyweb:AEO_audit." >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
case "$NODE_MAJOR" in
  ''|*[!0-9]*) NODE_MAJOR=0 ;;
esac
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18 or newer is required. Current node major version: $NODE_MAJOR" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "$TMP_PARENT/lazyweb-aeo-install.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

copy_tree() {
  src="$1"
  dest="$2"
  tmp_dest="$dest.tmp"

  rm -rf "$tmp_dest"
  mkdir -p "$tmp_dest"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude ".git" \
      --exclude "reports" \
      --exclude "tmp" \
      "$src"/ "$tmp_dest"/
  else
    (cd "$src" && tar --exclude "./.git" --exclude "./reports" --exclude "./tmp" -cf - .) | (cd "$tmp_dest" && tar -xf -)
  fi

  rm -rf "$dest"
  mv "$tmp_dest" "$dest"
}

fetch_source() {
  if [ -d "$REPO_URL" ]; then
    printf "%s\n" "$REPO_URL"
    return
  fi

  source_dir="$TMP_DIR/source"
  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 "$REPO_URL" "$source_dir" >/dev/null 2>&1
    printf "%s\n" "$source_dir"
    return
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "Install needs either git or curl." >&2
    exit 1
  fi

  archive="$TMP_DIR/source.tar.gz"
  curl -fsSL "$TARBALL_URL" -o "$archive"
  tar -xzf "$archive" -C "$TMP_DIR"
  extracted="$(find "$TMP_DIR" -maxdepth 1 -type d -name "Lazyweb-aeo-audit-skill-*" | head -n 1)"
  if [ -z "$extracted" ]; then
    echo "Could not unpack Lazyweb:AEO_audit." >&2
    exit 1
  fi
  printf "%s\n" "$extracted"
}

install_skill() {
  skills_root="$1"
  mkdir -p "$skills_root"
  copy_tree "$INSTALL_ROOT" "$skills_root/$SKILL_DIR_NAME"
}

SOURCE_DIR="$(fetch_source)"
mkdir -p "$(dirname "$INSTALL_ROOT")"
copy_tree "$SOURCE_DIR" "$INSTALL_ROOT"
chmod +x "$INSTALL_ROOT/bin/lazyweb-aeo-audit.mjs"

mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/lazyweb-aeo-audit" <<EOF
#!/bin/sh
exec "$INSTALL_ROOT/bin/lazyweb-aeo-audit.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/lazyweb-aeo-audit"

install_skill "$HOME/.codex/skills"
install_skill "$HOME/.claude/skills"

"$BIN_DIR/lazyweb-aeo-audit" --help >/dev/null

echo "Installed Lazyweb:AEO_audit"
echo "CLI: $BIN_DIR/lazyweb-aeo-audit"
echo "Codex skill: $HOME/.codex/skills/$SKILL_DIR_NAME"
echo "Claude skill: $HOME/.claude/skills/$SKILL_DIR_NAME"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo ""
    echo "Add this to your shell profile if lazyweb-aeo-audit is not found:"
    echo "export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo ""
echo "First run:"
echo "  lazyweb-aeo-audit"
