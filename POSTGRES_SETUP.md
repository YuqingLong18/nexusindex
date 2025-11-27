# PostgreSQL pg_hba.conf Configuration Guide

## Your PostgreSQL Configuration File Path

**For BaoTa installations, the path is:**
```
/www/server/pgsql/data/pg_hba.conf
```

This guide uses this exact path. If your installation is different, replace `/www/server/pgsql/data/` with your actual path.

## Step 1: Check Current Configuration

Before editing, let's see what's currently in the file:

```bash
sudo cat /www/server/pgsql/data/pg_hba.conf
```

You'll see something like this:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer
# IPv4 local connections:
host    all             all             127.0.0.1/32            ident
# IPv6 local connections:
host    all             all             ::1/128                 ident
```

## Step 2: Backup the File (IMPORTANT!)

Always backup before editing:

```bash
sudo cp /www/server/pgsql/data/pg_hba.conf /www/server/pgsql/data/pg_hba.conf.backup
```

## Step 3: Edit the File

### Option A: Using vi/vim (recommended)

```bash
# Open the file with sudo
sudo vi /www/server/pgsql/data/pg_hba.conf
```

**In vi editor:**
1. Press `i` to enter INSERT mode
2. Navigate to the section for IPv4 local connections (around line with `127.0.0.1`)
3. Find the line that looks like:
   ```
   host    all             all             127.0.0.1/32            ident
   ```
4. Change `ident` to `md5`:
   ```
   host    all             all             127.0.0.1/32            md5
   ```
5. Check if there's a `local` line. If it says `peer`, change it to `md5`:
   ```
   local   all             all                                     md5
   ```
6. Press `Esc` to exit INSERT mode
7. Type `:wq` and press Enter to save and quit

### Option B: Using nano (easier for beginners)

```bash
sudo nano /www/server/pgsql/data/pg_hba.conf
```

1. Find the lines mentioned above
2. Edit them directly (just type to change)
3. Press `Ctrl+X` to exit
4. Press `Y` to confirm save
5. Press `Enter` to confirm filename

### Option C: Using sed (automated - EASIEST METHOD)

```bash
# Backup first!
sudo cp /www/server/pgsql/data/pg_hba.conf /www/server/pgsql/data/pg_hba.conf.backup

# Replace ident with md5 for IPv4 connections
sudo sed -i 's/127.0.0.1\/32.*ident/127.0.0.1\/32            md5/' /www/server/pgsql/data/pg_hba.conf

# Replace peer with md5 for local connections
sudo sed -i 's/^local.*peer/local   all             all                                     md5/' /www/server/pgsql/data/pg_hba.conf
```

## Step 4: Verify Your Changes

After editing, verify the file looks correct:

```bash
sudo cat /www/server/pgsql/data/pg_hba.conf | grep -E "(local|127.0.0.1)"
```

**You should see:**
```
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

If you see `ident` or `peer` instead of `md5`, the changes didn't work. Try the manual edit method.

## Step 5: Restart PostgreSQL

**For BaoTa installations, restart via BaoTa Panel:**
1. BaoTa Panel → Database → PostgreSQL
2. Click "Restart" (重启)

**Or via command line:**
```bash
# Find the service name
systemctl list-units | grep postgresql

# Restart (common names for BaoTa):
sudo systemctl restart postgresql
# OR
sudo systemctl restart pgsql
# OR check BaoTa's service name:
sudo /etc/init.d/pgsql restart

# Verify it's running
sudo systemctl status postgresql
```

## Step 6: Test the Connection

```bash
# Test connection with password authentication
psql -U postgres -h localhost -d postgres

# You should be prompted for password
# If it works, you're all set!
```

## Complete Example Session (Copy-Paste Ready)

Here's the exact sequence of commands for your BaoTa server:

```bash
# 1. Backup the file
sudo cp /www/server/pgsql/data/pg_hba.conf /www/server/pgsql/data/pg_hba.conf.backup

# 2. View current content (to see what needs changing)
sudo cat /www/server/pgsql/data/pg_hba.conf | grep -v "^#" | grep -v "^$"

# 3. Make the changes (automated method)
sudo sed -i 's/127.0.0.1\/32.*ident/127.0.0.1\/32            md5/' /www/server/pgsql/data/pg_hba.conf
sudo sed -i 's/^local.*peer/local   all             all                                     md5/' /www/server/pgsql/data/pg_hba.conf

# 4. Verify changes worked
sudo cat /www/server/pgsql/data/pg_hba.conf | grep -E "(local|127.0.0.1)"

# You should see:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5

# 5. Restart PostgreSQL (via BaoTa Panel OR command line)
# Via BaoTa: Database → PostgreSQL → Restart
# OR via command:
sudo /etc/init.d/pgsql restart
# OR
sudo systemctl restart postgresql

# 6. Test connection
psql -U postgres -h localhost -d postgres
# Enter password when prompted
```

## Troubleshooting

### If PostgreSQL won't start after editing:

```bash
# Check PostgreSQL logs (BaoTa location)
sudo tail -f /www/server/pgsql/data/log/postgresql-*.log

# Restore backup if needed
sudo cp /www/server/pgsql/data/pg_hba.conf.backup /www/server/pgsql/data/pg_hba.conf

# Restart via BaoTa Panel OR:
sudo /etc/init.d/pgsql restart
```

### If the sed commands don't work:

The file format might be slightly different. Use manual editing instead:

```bash
# Open with nano (easier than vi)
sudo nano /www/server/pgsql/data/pg_hba.conf

# Look for lines like:
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            ident

# Change "peer" to "md5" and "ident" to "md5"
# Save: Ctrl+X, then Y, then Enter
```

### Common Mistakes:

1. **Wrong path**: Make sure you're editing the file in the PostgreSQL data directory
2. **Wrong permissions**: Use `sudo` to edit
3. **Syntax errors**: Make sure there are tabs/spaces between fields
4. **Forgetting to restart**: Always restart PostgreSQL after changes

## What Each Method Means:

- **`peer`**: Uses OS username (no password, but requires matching OS user)
- **`ident`**: Similar to peer, uses OS authentication
- **`md5`**: Password authentication (what we want for remote connections)
- **`trust`**: No password required (NOT recommended for production)

## Quick Reference for BaoTa Users

**File Path:** `/www/server/pgsql/data/pg_hba.conf`

**Quick Method (Copy-Paste These Commands):**
```bash
# Backup
sudo cp /www/server/pgsql/data/pg_hba.conf /www/server/pgsql/data/pg_hba.conf.backup

# Make changes
sudo sed -i 's/127.0.0.1\/32.*ident/127.0.0.1\/32            md5/' /www/server/pgsql/data/pg_hba.conf
sudo sed -i 's/^local.*peer/local   all             all                                     md5/' /www/server/pgsql/data/pg_hba.conf

# Verify
sudo cat /www/server/pgsql/data/pg_hba.conf | grep -E "(local|127.0.0.1)"

# Restart (choose one method):
# Via BaoTa Panel: Database → PostgreSQL → Restart
# OR via command:
sudo /etc/init.d/pgsql restart
```

**Alternative:** You can also edit via BaoTa Panel → Database → PostgreSQL → Configuration Files → pg_hba.conf

