# Deployment Guide for CentOS with BaoTa Panel

This guide walks you through deploying the thisnexus.cn applications on a CentOS server with BaoTa (宝塔) panel.

## Architecture Overview

- **Main Site** (`thisnexus.cn`): Node.js credential database API on port 3000
- **Translation App** (`translate.thisnexus.cn`): Flask/Python app on port 3001
- **PostgreSQL**: Database for credential storage
- **Reverse Proxy**: BaoTa Nginx for SSL and domain routing

---

## Prerequisites

1. CentOS server with BaoTa panel installed
2. Domain `thisnexus.cn` and subdomain `translate.thisnexus.cn` DNS pointing to your server IP
3. SSH access to your server
4. Root or sudo access

---

## Step 1: Install Required Software

### 1.1 Install Node.js (via BaoTa or manually)

**Option A: Via BaoTa Panel**
1. Open BaoTa panel → Software Store (软件商店)
2. Search for "Node.js版本管理器"
3. Install Node.js version 18.x or 20.x

**Option B: Via Command Line**
```bash
# Install Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.2 Install Python 3 and pip

```bash
# Check if Python 3 is installed
python3 --version

# If not installed, install Python 3.10+
yum install -y python3 python3-pip python3-devel

# Install virtualenv
pip3 install virtualenv

# Verify installation
python3 --version
pip3 --version
```

### 1.3 Install PostgreSQL

**Via BaoTa Panel:**
1. BaoTa Panel → Software Store → Search "PostgreSQL"
2. Install PostgreSQL 14 or 15
3. Note the default password shown during installation

**Via Command Line:**
```bash
# Install PostgreSQL repository
yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Install PostgreSQL 15
yum install -y postgresql15-server postgresql15

# Initialize database
/usr/pgsql-15/bin/postgresql-15-setup initdb

# Start and enable PostgreSQL
systemctl start postgresql-15
systemctl enable postgresql-15
```

---

## Step 2: Configure PostgreSQL

### 2.1 Set PostgreSQL Password

```bash
# Switch to postgres user
su - postgres

# Access PostgreSQL
psql

# In PostgreSQL prompt, set password
ALTER USER postgres PASSWORD 'your_secure_password_here';

# Create database for credentials
CREATE DATABASE credentials;

# Create user for the application (optional, or use postgres user)
CREATE USER credentials_user WITH PASSWORD 'your_app_password';
GRANT ALL PRIVILEGES ON DATABASE credentials TO credentials_user;

# Exit PostgreSQL
\q
exit
```

### 2.2 Configure PostgreSQL Access

Edit PostgreSQL config to allow local connections:

```bash
# Edit pg_hba.conf (path may vary)
vi /var/lib/pgsql/15/data/pg_hba.conf

# Ensure these lines exist (for local connections):
host    all             all             127.0.0.1/32            md5
local   all             all                                     md5

# Restart PostgreSQL
systemctl restart postgresql-15
```

### 2.3 Initialize Credential Database Schema

```bash
# Switch to postgres user
su - postgres

# Run the schema SQL
psql -d credentials -f /path/to/index/schema.sql

# Or manually create the table:
psql -d credentials
```

Then in PostgreSQL prompt:
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_username ON users(username);
GRANT ALL PRIVILEGES ON TABLE users TO credentials_user;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO credentials_user;
\q
```

```bash
exit
```

---

## Step 3: Deploy Main Site (Credential Database API)

### 3.1 Upload Files to Server

**Via BaoTa File Manager:**
1. BaoTa Panel → Files (文件管理)
2. Navigate to `/www/wwwroot/`
3. Create folder `index`
4. Upload all files from your local `index` folder

**Via Git (Recommended):**
```bash
cd /www/wwwroot/
git clone <your-repo-url> index
cd index
```

**Via SCP from your local machine:**
```bash
# From your local machine
scp -r /Users/ylong/Documents/index root@your-server-ip:/www/wwwroot/
```

### 3.2 Install Dependencies

```bash
cd /www/wwwroot/index
npm install
```

### 3.3 Configure Environment Variables

```bash
# Create .env file
vi .env
```

Add the following content:
```env
# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=credentials
DB_USER=credentials_user
DB_PASSWORD=xm8wreWmBr!

# Server Configuration
PORT=3000
```

Save and exit (`:wq` in vi)

### 3.4 Test the Application

```bash
# Test run
npm start

# Should see: "Credential database API running on port 3000"
# Press Ctrl+C to stop
```

### 3.5 Set Up PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
cd /www/wwwroot/index
pm2 start server.js --name credential-db

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

---

## Step 4: Deploy Translation App

### 4.1 Upload Files to Server

```bash
cd /www/wwwroot/
# Upload translateppt folder (via SCP, Git, or BaoTa File Manager)
```

### 4.2 Set Up Python Virtual Environment

```bash
cd /www/wwwroot/translateppt

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Install Gunicorn for production
pip install gunicorn
```

### 4.3 Configure Environment Variables

```bash
# Create .env file
vi .env
```

Add the following:
```env
# Flask Configuration
SECRET_KEY=your-secret-key-here-generate-random-string
FLASK_ENV=production

# Credential Database URL
CREDENTIAL_DB_URL=http://localhost:3000

# OpenRouter (optional)
OPENROUTER_API_KEY=sk-your-key-here

# Server Configuration
HOST=127.0.0.1
PORT=3001
```

### 4.4 Create Gunicorn Configuration

```bash
# Create gunicorn config file
vi gunicorn_config.py
```

Add:
```python
bind = "127.0.0.1:3001"
workers = 3
threads = 4
timeout = 120
worker_class = "sync"
chdir = "/www/wwwroot/translateppt"
```

### 4.5 Test the Application

```bash
# Activate virtual environment
source venv/bin/activate

# Test run with Gunicorn
gunicorn -c gunicorn_config.py 'backend.app:create_app()'

# Should see Gunicorn starting
# Press Ctrl+C to stop
```

### 4.6 Set Up PM2 for Python App

```bash
# Install pm2 for Python
pm2 start gunicorn --name translateppt -- -c /www/wwwroot/translateppt/gunicorn_config.py 'backend.app:create_app()'

# Or create ecosystem file
vi ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [{
    name: 'translateppt',
    script: 'gunicorn',
    args: '-c /www/wwwroot/translateppt/gunicorn_config.py "backend.app:create_app()"',
    cwd: '/www/wwwroot/translateppt',
    interpreter: '/www/wwwroot/translateppt/venv/bin/python',
    env: {
      PATH: '/www/wwwroot/translateppt/venv/bin:/usr/local/bin:/usr/bin:/bin'
    }
  }]
};
```

```bash
# Start with ecosystem file
pm2 start ecosystem.config.js
pm2 save
```

---

## Step 5: Configure BaoTa Reverse Proxy

### 5.1 Set Up Main Domain (thisnexus.cn)

1. **BaoTa Panel → Website (网站) → Add Site (添加站点)**
   - Domain: `thisnexus.cn`
   - Create database: No (we're using PostgreSQL separately)
   - PHP version: Not needed (Node.js app)
   - Click "Submit" (提交)

2. **Configure Reverse Proxy:**
   - Click on your site → Settings (设置) → Reverse Proxy (反向代理)
   - Click "Add Reverse Proxy" (添加反向代理)
   - **Proxy Name**: `credential-api`
   - **Target URL**: `http://127.0.0.1:3000`
   - **Send Domain**: `$host`
   - **Cache**: Disable
   - Click "Submit"

3. **Edit Nginx Configuration:**
   - Click "Configuration File" (配置文件)
   - Find the location block and modify:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

4. **Save and Reload Nginx**

### 5.2 Set Up Subdomain (translate.thisnexus.cn)

1. **Add Subdomain Site:**
   - BaoTa Panel → Website → Add Site
   - Domain: `translate.thisnexus.cn`
   - Click "Submit"

2. **Configure Reverse Proxy:**
   - Click on translate.thisnexus.cn → Settings → Reverse Proxy
   - Add Reverse Proxy:
     - **Target URL**: `http://127.0.0.1:3001`
     - **Send Domain**: `$host`
   - Click "Submit"

3. **Edit Nginx Configuration:**
   - Same proxy settings as above, but pointing to port 3001

### 5.3 Configure SSL Certificates

1. **BaoTa Panel → Website → Select Site → SSL**
2. **Apply Let's Encrypt Certificate:**
   - Click "Apply" (申请)
   - Select both domains: `thisnexus.cn` and `translate.thisnexus.cn`
   - Email: Your email address
   - Click "Apply"
3. **Enable Force HTTPS** (强制HTTPS)
4. **Auto-renewal** should be enabled by default

---

## Step 6: Configure Firewall

### 6.1 BaoTa Firewall Settings

1. **BaoTa Panel → Security (安全) → Firewall (防火墙)**
2. Ensure ports are open:
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 22 (SSH)
   - Port 3000 (only localhost, not public)
   - Port 3001 (only localhost, not public)

### 6.2 System Firewall (if using firewalld)

```bash
# Allow HTTP and HTTPS
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

---

## Step 7: Add Initial Users

### 7.1 Add User to Credential Database

```bash
cd /www/wwwroot/index
node add-user.js username password
```

Example:
```bash
node add-user.js admin mySecurePassword123
```

---

## Step 8: Verify Deployment

### 8.1 Check Services Status

```bash
# Check PM2 processes
pm2 status

# Check PostgreSQL
systemctl status postgresql-15

# Check Nginx
systemctl status nginx
```

### 8.2 Test Endpoints

1. **Main Site**: Visit `https://thisnexus.cn`
   - Should show the index.html page
   - Health check: `https://thisnexus.cn/health`

2. **Translation App**: Visit `https://translate.thisnexus.cn`
   - Should redirect to login page
   - After login, should show translation interface

3. **API Test**:
```bash
# Test credential API
curl http://localhost:3000/health

# Test translation API (should require auth)
curl http://localhost:3001/health
```

---

## Step 9: Monitoring and Maintenance

### 9.1 PM2 Monitoring

```bash
# View logs
pm2 logs credential-db
pm2 logs translateppt

# Restart services
pm2 restart credential-db
pm2 restart translateppt

# Monitor resources
pm2 monit
```

### 9.2 Set Up Log Rotation

```bash
# PM2 logs are automatically rotated
# For application logs, configure in BaoTa or manually
```

### 9.3 Backup PostgreSQL

```bash
# Create backup script
vi /root/backup-credentials.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup credentials database
su - postgres -c "pg_dump credentials" > $BACKUP_DIR/credentials_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "credentials_*.sql" -mtime +7 -delete
```

```bash
chmod +x /root/backup-credentials.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /root/backup-credentials.sh
```

---

## Troubleshooting

### Issue: PM2 not starting on boot
```bash
pm2 startup
# Follow the command shown
pm2 save
```

### Issue: Cannot connect to PostgreSQL
```bash
# Check PostgreSQL is running
systemctl status postgresql-15

# Check connection
psql -U postgres -h localhost -d credentials
```

### Issue: Port already in use
```bash
# Check what's using the port
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001

# Kill the process if needed
kill -9 <PID>
```

### Issue: Nginx 502 Bad Gateway
- Check if backend services are running: `pm2 status`
- Check Nginx error logs: BaoTa → Website → Logs
- Verify proxy_pass URL is correct

### Issue: SSL Certificate not working
- Ensure DNS records point to server IP
- Check firewall allows port 80/443
- Wait a few minutes for DNS propagation

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong passwords for all services
- [ ] Enable firewall and restrict ports
- [ ] Set up SSL certificates
- [ ] Regularly update system packages
- [ ] Set up automated backups
- [ ] Monitor PM2 logs regularly
- [ ] Keep Node.js and Python dependencies updated
- [ ] Use environment variables for sensitive data
- [ ] Restrict database access to localhost only

---

## Quick Reference Commands

```bash
# Start services
pm2 start credential-db
pm2 start translateppt

# Stop services
pm2 stop credential-db
pm2 stop translateppt

# Restart services
pm2 restart all

# View logs
pm2 logs

# PostgreSQL commands
systemctl start postgresql-15
systemctl stop postgresql-15
systemctl restart postgresql-15

# Add user to credential database
cd /www/wwwroot/index
node add-user.js <username> <password>
```

---

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs in BaoTa panel
3. Check PostgreSQL logs: `/var/lib/pgsql/15/data/log/`
4. Verify environment variables are set correctly
5. Ensure all ports are accessible locally

