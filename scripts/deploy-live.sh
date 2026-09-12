#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🌐 SwarmProof Production Live Deployment Suite"
echo "=========================================================="
echo ""
echo "Choose your target deployment action:"
echo "  1) Start instant public HTTPS live tunnel (ngrok)"
echo "  2) Push latest code to GitHub (triggers Vercel/Render CI/CD)"
echo "  3) Deploy Web Frontend to Vercel (CLI)"
echo "  4) Build Production Docker Containers"
echo ""

case "$1" in
  tunnel)
    ./scripts/tunnel-live.sh
    ;;
  push)
    git push origin main
    ;;
  vercel)
    cd apps/web && npx vercel --prod
    ;;
  docker)
    docker compose -f docker-compose.prod.yml build
    ;;
  *)
    echo "Usage: ./scripts/deploy-live.sh [tunnel|push|vercel|docker]"
    echo ""
    echo "For immediate public access right now: ./scripts/deploy-live.sh tunnel"
    ;;
esac
