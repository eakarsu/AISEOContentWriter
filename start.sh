#!/bin/bash

# ============================================
# AI SEO Content Writer - Startup Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     AI SEO Content Writer                 ║"
echo "  ║     Starting Application...               ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Step 1: Clean up used ports ----
echo -e "${YELLOW}[1/6] Cleaning up used ports...${NC}"

cleanup_port() {
  local port=$1
  local pids=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "  ${RED}Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo -e "  ${GREEN}Port $port is available${NC}"
  fi
}

cleanup_port 3000
cleanup_port 3001
sleep 2

# ---- Step 2: Check PostgreSQL ----
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"
if command -v pg_isready &>/dev/null; then
  if pg_isready -q 2>/dev/null; then
    echo -e "  ${GREEN}PostgreSQL is running${NC}"
  else
    echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
    if command -v brew &>/dev/null; then
      brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    sleep 2
  fi
else
  echo -e "  ${YELLOW}pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ---- Step 3: Create database if not exists ----
echo -e "${YELLOW}[3/6] Setting up database...${NC}"
DB_NAME="${DB_NAME:-ai_seo_content_writer}"
DB_USER="${DB_USER:-postgres}"

# Try to create database (ignore error if exists)
createdb -U "$DB_USER" "$DB_NAME" 2>/dev/null && echo -e "  ${GREEN}Database '$DB_NAME' created${NC}" || echo -e "  ${GREEN}Database '$DB_NAME' already exists${NC}"

# ---- Step 4: Install dependencies ----
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  echo -e "  Installing server dependencies..."
  npm install --silent 2>&1 | tail -1
fi
if [ ! -d "client/node_modules" ]; then
  echo -e "  Installing client dependencies..."
  cd client && npm install --silent 2>&1 | tail -1 && cd ..
fi
echo -e "  ${GREEN}Dependencies ready${NC}"

# ---- Step 5: Seed database ----
echo -e "${YELLOW}[5/6] Seeding database...${NC}"
node server/seed.js 2>&1
echo -e "  ${GREEN}Database seeded${NC}"

# ---- Step 6: Start application with hot reload ----
echo -e "${YELLOW}[6/6] Starting application with hot reload...${NC}"
echo ""
echo -e "${GREEN}  ✅ Backend:  http://localhost:3001${NC}"
echo -e "${GREEN}  ✅ Frontend: http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}  Login: demo@seocontent.ai / password123${NC}"
echo -e "${BLUE}  Use the 'Quick Demo Login' button to auto-fill credentials${NC}"
echo ""
echo -e "${YELLOW}  Both servers will auto-reload on code changes.${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop all services.${NC}"
echo ""

# Start backend with nodemon (hot reload) and frontend with react-scripts (hot reload)
npx concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "blue,green" \
  "npx nodemon server/index.js" \
  "cd client && PORT=3000 BROWSER=none npm start"
