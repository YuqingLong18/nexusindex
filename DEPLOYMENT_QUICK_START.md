# Quick Deployment Checklist

## Pre-Deployment

- [ ] Server has BaoTa panel installed
- [ ] DNS records configured:
  - `thisnexus.cn` → Server IP
  - `translate.thisnexus.cn` → Server IP
- [ ] SSH access to server

## Step-by-Step Quick Commands

### 1. Install Software (SSH into server)

```bash
# Node.js (if not installed)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Python 3 (if not installed)
yum install -y python3 python3-pip python3-devel
pip3 install virtualenv

# PostgreSQL (via BaoTa or command line)
# Via BaoTa: Software Store → PostgreSQL
```

### 2. Set Up PostgreSQL

```bash
# Switch to postgres user
su - postgres

# Create database
psql
CREATE DATABASE credentials;
\q

# Run schema
psql -d credentials -f /www/wwwroot/index/schema.sql
exit
```

### 3. Deploy Main Site (Credential DB)

```bash
# Upload files to /www/wwwroot/index (via SCP, Git, or BaoTa File Manager)
cd /www/wwwroot/index

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=credentials
DB_USER=postgres
DB_PASSWORD=your_postgres_password
PORT=3000
EOF

# Install PM2 and start
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

### 4. Deploy Translation App

```bash
# Upload files to /www/wwwroot/translateppt
cd /www/wwwroot/translateppt

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install gunicorn

# Create logs directory
mkdir -p logs

# Create .env file
cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
CREDENTIAL_DB_URL=http://localhost:3000
HOST=127.0.0.1
PORT=3001
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

### 5. Configure BaoTa Reverse Proxy

**Main Domain (thisnexus.cn):**
1. BaoTa → Website → Add Site → `thisnexus.cn`
2. Settings → Reverse Proxy → Add
   - Target: `http://127.0.0.1:3000`
3. SSL → Apply Let's Encrypt → Enable Force HTTPS

**Subdomain (translate.thisnexus.cn):**
1. BaoTa → Website → Add Site → `translate.thisnexus.cn`
2. Settings → Reverse Proxy → Add
   - Target: `http://127.0.0.1:3001`
3. SSL → Apply Let's Encrypt → Enable Force HTTPS

### 6. Add Initial User

```bash
cd /www/wwwroot/index
node add-user.js admin yourpassword
```

### 7. Verify

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Test locally
curl http://localhost:3000/health
curl http://localhost:3001/health
```

## Common Issues

**Port in use:**
```bash
netstat -tulpn | grep :3000
kill -9 <PID>
```

**PM2 not starting:**
```bash
pm2 restart all
pm2 logs
```

**PostgreSQL connection error:**
```bash
systemctl restart postgresql-15
# Check /var/lib/pgsql/15/data/pg_hba.conf
```

**Nginx 502:**
- Check PM2: `pm2 status`
- Check Nginx logs in BaoTa
- Verify proxy_pass URL

