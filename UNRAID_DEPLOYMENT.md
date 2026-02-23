# 🚀 Unraid Deployment Guide - Twitch Drops Miner

**Target URL:** http://192.168.1.99:5173  
**Last Updated:** 2026-02-23  
**Status:** Production Ready ✅

---

## 📋 Prerequisites

- ✅ Unraid server running
- ✅ Docker enabled in Unraid
- ✅ Access to Unraid web interface
- ✅ Project files available on Unraid share

---

## 🚀 Quick Start (3 Steps)

### **Step 1: Copy Files to Unraid**

1. **Access your Unraid shares** (via SMB or Unraid web UI)
2. **Copy project folder** to Unraid share:
   - Recommended: `/mnt/user/appdata/twitch-drops-miner/`
   - Or use your preferred appdata location

3. **Ensure these files are present:**
   - `Dockerfile`
   - `docker-compose-unraid.yml`
   - `package.json`
   - `server.ts`
   - All `src/` files

### **Step 2: Deploy via Unraid CLI**

1. **SSH into Unraid** or use **Unraid Terminal**
2. **Navigate to project folder:**
   ```bash
   cd /mnt/user/appdata/twitch-drops-miner
   ```

3. **Build and start container:**
   ```bash
   # Build Docker image
   docker-compose -f docker-compose-unraid.yml build
   
   # Start container
   docker-compose -f docker-compose-unraid.yml up -d
   ```

### **Step 3: Access Application**

**Web Interface:** http://192.168.1.99:5173

---

## 📱 Alternative: Unraid Docker Management

### **Option A: Unraid Web UI (Community Applications)**

1. **Install "CA User Scripts" plugin** from Community Applications
2. **Create a new script:**
   - Go to **Settings** → **User Utilities** → **User Scripts**
   - Click **Add New Script**
   - Name it: `TwitchDropsMiner`

3. **Script content:**
   ```bash
   #!/bin/bash
   cd /mnt/user/appdata/twitch-drops-miner
   docker-compose -f docker-compose-unraid.yml up -d
   ```

4. **Schedule:** Run at Startup
5. **Click "Run Now"** to start

### **Option B: Unraid Docker Tab (Manual)**

1. **Go to Docker tab in Unraid**
2. **Add Container** → **Select: "Other"**
3. **Use docker-compose-unraid.yml** as reference
4. **Configure:**
   - Name: `twitch-drops-miner`
   - Repository: `twitch-drops-miner:latest` (build first)
   - Port 5173:3000
   - Volume: `/mnt/user/appdata/twitch-drops-miner/data:/app/data`

---

## 🔧 Docker Compose Configuration

The `docker-compose-unraid.yml` includes:

```yaml
ports:
  - "5173:3000"  # External port 5173 → Internal port 3000

volumes:
  - ./data:/app/data     # Database persistence
  - ./logs:/app/logs     # Log files

labels:
  - "net.unraid.docker.managed=dockerman"
  - "net.unraid.docker.icon=..."
```

---

## 📊 Unraid-Specific Settings

### **Timezone Configuration**

Edit `docker-compose-unraid.yml`:

```yaml
environment:
  - TZ=America/New_York  # Change to your timezone
```

### **Volume Paths**

Unraid recommended paths:
```yaml
volumes:
  - /mnt/user/appdata/twitch-drops-miner/data:/app/data
  - /mnt/user/appdata/twitch-drops-miner/logs:/app/logs
```

### **Network Mode**

For Unraid, the default `bridge` network is recommended.

---

## 🎯 First Run Configuration

1. **Access** http://192.168.1.99:5173
2. **Go to Settings** → **Twitch API Configuration**
3. **Enter your Twitch Client ID**
4. **Save Changes**
5. **Add your account** via OAuth Device Flow
6. **Start farming!**

---

## 🔍 Monitoring on Unraid

### **Check Container Status:**
```bash
docker ps | grep twitch-drops-miner
```

### **View Logs:**
```bash
docker logs -f twitch-drops-miner
```

### **Unraid Dashboard:**
- Go to **Docker** tab
- Find `twitch-drops-miner` container
- Click **Log** button

---

## 🛠️ Management Commands

### **Start:**
```bash
docker-compose -f docker-compose-unraid.yml up -d
```

### **Stop:**
```bash
docker-compose -f docker-compose-unraid.yml down
```

### **Restart:**
```bash
docker-compose -f docker-compose-unraid.yml restart
```

### **Update:**
```bash
# Pull latest code (if using git)
git pull

# Rebuild
docker-compose -f docker-compose-unraid.yml build --no-cache

# Restart
docker-compose -f docker-compose-unraid.yml up -d
```

---

## 📁 Unraid File Structure

```
/mnt/user/appdata/twitch-drops-miner/
├── Dockerfile
├── docker-compose-unraid.yml
├── package.json
├── server.ts
├── src/
│   ├── components/
│   └── ...
├── data/              # SQLite database (auto-created)
│   └── farm.db
└── logs/              # Application logs (auto-created)
```

---

## 🔒 Unraid Security

### **Firewall Settings**

Ensure port 5173 is accessible:
1. **Unraid Settings** → **Network Rules**
2. **Add rule** to allow port 5173 (if needed)

### **HTTPS (Optional)**

For HTTPS access, use **Nginx Proxy Manager** or **SWAG** on Unraid:

1. **Install SWAG** from Community Applications
2. **Configure proxy** for `twitch-drops-miner`
3. **Enable SSL** with Let's Encrypt

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5173 not accessible | Check Unraid firewall and port forwarding |
| Container won't start | Check logs: `docker logs twitch-drops-miner` |
| Database errors | Ensure `/data` directory is writable |
| Can't access web UI | Verify container is running: `docker ps` |

---

## 🔄 Backup Strategy

### **Automated Backup (Unraid):**

1. **Install "CA Backup/Appdata Backup" plugin**
2. **Add to backup list:**
   - `/mnt/user/appdata/twitch-drops-miner/`

3. **Schedule:** Daily backups

### **Manual Backup:**
```bash
# Stop container
docker-compose -f docker-compose-unraid.yml down

# Copy data directory
cp -r /mnt/user/appdata/twitch-drops-miner/data /mnt/user/backup/

# Restart container
docker-compose -f docker-compose-unraid.yml up -d
```

---

## 📈 Performance Tuning

### **Resource Limits** (Unraid Docker Settings):

Add to `docker-compose-unraid.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      memory: 512M
```

---

## ✅ Pre-Flight Checklist

Before deploying on Unraid:

- [ ] Unraid Docker enabled
- [ ] Port 5173 available/forwarded
- [ ] Appdata share configured
- [ ] Project files copied to Unraid
- [ ] Twitch Client ID ready
- [ ] Backup strategy configured

---

## 🎉 Success Indicators

Once deployed, you should see:

✅ **Container:** Running in Docker tab  
✅ **Web UI:** Accessible at http://192.168.1.99:5173  
✅ **Logs:** Show "Server running on http://localhost:3000"  
✅ **Health Check:** Passing (green indicator)  

---

## 📞 Support

- **Memory ID:** mzaCEvSj73
- **Documentation:** DEPLOYMENT.md, IMPLEMENTATION_SUMMARY.md
- **Unraid Forums:** https://forums.unraid.com/

---

**Ready to deploy on Unraid!** 🚀

**Last Updated:** 2026-02-23  
**Status:** Production Ready ✅
