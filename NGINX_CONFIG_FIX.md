# Fixing Nginx Duplicate Location Error

## Problem
You're getting: `duplicate location "/"` because there's already a `location /` block in your Nginx config.

## Solution: Replace the Existing Location Block

### Step 1: View Current Configuration

In BaoTa Panel:
1. Go to **Website** → Select `thisnexus.cn` → **Settings** → **Configuration File**
2. Look for the existing `location /` block (around line 55)

You'll probably see something like:
```nginx
location / {
    root /www/wwwroot/thisnexus.cn;
    index index.html index.htm;
    try_files $uri $uri/ =404;
}
```

### Step 2: Replace It

**Delete the entire existing `location /` block** and replace it with:

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

### Step 3: Alternative - Use BaoTa Reverse Proxy Feature

**Easier Method via BaoTa Panel:**

1. **Website** → `thisnexus.cn` → **Settings** → **Reverse Proxy**
2. If there's already a reverse proxy configured, **delete it first**
3. Click **Add Reverse Proxy** (添加反向代理)
4. Fill in:
   - **Proxy Name**: `credential-api` (or any name)
   - **Target URL**: `http://127.0.0.1:3000`
   - **Send Domain**: `$host`
   - **Cache**: Disable
5. Click **Submit**

BaoTa will automatically configure the Nginx location block correctly without duplicates.

## For translate.thisnexus.cn

Do the same for the subdomain:

1. **Website** → `translate.thisnexus.cn` → **Settings** → **Reverse Proxy**
2. **Add Reverse Proxy**:
   - **Target URL**: `http://127.0.0.1:3001`
   - **Send Domain**: `$host`
3. Click **Submit**

## Manual Edit Method (If Needed)

If you prefer to edit manually:

1. **Website** → `thisnexus.cn` → **Settings** → **Configuration File**
2. Find the `server` block for `thisnexus.cn`
3. Look for the existing `location /` block
4. **Replace the entire block** (from `location / {` to `}`) with the proxy configuration above
5. Click **Save**
6. Click **Reload** (重载配置)

## Complete Example Configuration

Here's what your `server` block should look like:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name thisnexus.cn www.thisnexus.cn;
    
    # SSL certificates (if configured)
    # ssl_certificate ...
    # ssl_certificate_key ...
    
    # Only ONE location / block
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
    
    # Other location blocks (if any)
    # location /static { ... }
    # location /api { ... }
}
```

## Troubleshooting

### If you still get errors:

1. **Check for multiple `location /` blocks:**
   ```bash
   grep -n "location /" /www/server/panel/vhost/nginx/thisnexus.cn.conf
   ```
   This will show all `location /` blocks with line numbers.

2. **Remove all but one** - keep only the proxy_pass version.

3. **Check syntax:**
   ```bash
   nginx -t
   ```

4. **Reload Nginx:**
   ```bash
   systemctl reload nginx
   ```

## Recommended: Use BaoTa Reverse Proxy Feature

The easiest way is to use BaoTa's built-in reverse proxy feature - it handles all the configuration automatically and prevents duplicates.

