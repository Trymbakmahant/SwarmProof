#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "📦 SwarmProof NPM Package Launch: swarmproof-mcp"
echo "=========================================================="
echo ""

# 1. Build and verify package
echo "🔨 Building swarmproof-mcp..."
pnpm --filter swarmproof-mcp build

echo ""
echo "🔍 Checking npm authentication status..."
if npm whoami > /dev/null 2>&1; then
  USER=$(npm whoami)
  echo "✅ Logged in as: $USER"
  echo ""
  echo "🚀 Publishing swarmproof-mcp to https://registry.npmjs.org/ ..."
  cd packages/mcp
  npm publish --access public
  echo ""
  echo "🎉 Successfully published swarmproof-mcp to npm!"
  echo "   Test it via: npx -y swarmproof-mcp"
else
  echo "⚠️ You are not currently logged into npm in this shell."
  echo ""
  echo "To publish, run:"
  echo "   npm login"
  echo "   ./scripts/publish-npm.sh"
  echo ""
  echo "The verified production tarball has been packaged at:"
  echo "   packages/mcp/swarmproof-mcp-0.1.0.tgz"
fi
