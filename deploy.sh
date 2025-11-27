#!/bin/bash
# Deployment helper script for CentOS server
# Run this script on your server after uploading files

set -e

echo "=== Deployment Script for thisnexus.cn ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root${NC}"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
if ! command_exists node; then
    echo -e "${RED}Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}Python 3 not found. Please install Python 3 first.${NC}"
    exit 1
fi

if ! command_exists psql; then
    echo -e "${RED}PostgreSQL not found. Please install PostgreSQL first.${NC}"
    exit 1
fi

echo -e "${GREEN}Prerequisites check passed${NC}"
echo ""

# Set paths
INDEX_DIR="/www/wwwroot/index"
TRANSLATE_DIR="/www/wwwroot/translateppt"

# Deploy Credential Database
echo "=== Deploying Credential Database ==="
if [ ! -d "$INDEX_DIR" ]; then
    echo -e "${RED}Directory $INDEX_DIR not found${NC}"
    exit 1
fi

cd "$INDEX_DIR"

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file template...${NC}"
    cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=credentials
DB_USER=postgres
DB_PASSWORD=CHANGE_ME
PORT=3000
EOF
    echo -e "${YELLOW}Please edit .env file with your PostgreSQL credentials${NC}"
fi

# Install PM2 if not installed
if ! command_exists pm2; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Start with PM2
echo "Starting credential database with PM2..."
pm2 start ecosystem.config.js || pm2 restart credential-db
pm2 save

echo -e "${GREEN}Credential database deployed${NC}"
echo ""

# Deploy Translation App
echo "=== Deploying Translation App ==="
if [ ! -d "$TRANSLATE_DIR" ]; then
    echo -e "${RED}Directory $TRANSLATE_DIR not found${NC}"
    exit 1
fi

cd "$TRANSLATE_DIR"

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install gunicorn

# Create logs directory
mkdir -p logs

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file template...${NC}"
    SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > .env << EOF
SECRET_KEY=$SECRET_KEY
CREDENTIAL_DB_URL=http://localhost:3000
HOST=127.0.0.1
PORT=3001
EOF
    echo -e "${YELLOW}Please edit .env file if needed${NC}"
fi

# Start with PM2
echo "Starting translation app with PM2..."
pm2 start ecosystem.config.js || pm2 restart translateppt
pm2 save

echo -e "${GREEN}Translation app deployed${NC}"
echo ""

# Final status
echo "=== Deployment Status ==="
pm2 status

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure BaoTa reverse proxy (see DEPLOYMENT_GUIDE.md)"
echo "2. Set up SSL certificates in BaoTa"
echo "3. Add users: cd $INDEX_DIR && node add-user.js <username> <password>"
echo "4. Check logs: pm2 logs"

