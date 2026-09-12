#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "⚡ SwarmProof Instant Live Public HTTPS Tunnel (ngrok)"
echo "=========================================================="
echo ""
echo "Connecting port 3000 (Web App) to public internet..."
echo ""

ngrok http 3000 --log=stdout
