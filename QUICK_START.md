# 🚀 Quick Start Guide - Twitch Drops Miner

## 📋 Two Deployment Options

### **Option A: Development Mode** (Current - Running Now)

✅ **Already running** inside Agent Zero container

```bash
# Status: Running on PID 7933
# Port: 3000
# Access: http://localhost:3000
```

**Commands:**
```bash
cd /a0/usr/projects/project_1

# Check status
ps aux | grep tsx

# View logs
cat server.log

# Restart
kill $(cat server.pid)
npm run dev
```

---

### **Option B: Docker Mode** (Production - Isolated Container)

🐳 **Separate container** with full isolation

```bash
# Build and start
npm run docker:build
npm run docker:up

# View logs
npm run docker:logs

# Stop
npm run docker:down
```

**Access:** http://localhost:3000

---

## 🔄 Switching Between Modes

### **Dev → Docker**
```bash
# Stop dev server
cd /a0/usr/projects/project_1
kill $(cat server.pid) 2>/dev/null

# Start Docker
npm run docker:up
```

### **Docker → Dev**
```bash
# Stop Docker
npm run docker:down

# Start dev server
npm run dev
```

---

## 🎯 First Time Setup

### 1. **Open Web Interface**
Go to: http://localhost:3000

### 2. **Configure Twitch API**
- Navigate to **Settings** → **Twitch API Configuration**
- Enter your **Twitch Client ID**
- Click **Save Changes**

### 3. **Add Your Account**
- Go to **Accounts** tab
- Click **Add Account**
- Follow OAuth Device Flow

### 4. **Start Farming**
- Toggle account to **Farming** status
- Watch Dashboard for activity

---

## 📊 What's Included

✅ **Point Claiming** - Auto-claim every 5 minutes
✅ **Betting Engine** - Kelly Criterion strategy  
✅ **20/80 Allocation** - Drops vs Favorites
✅ **Real-time Analytics** - Dashboard monitoring
✅ **Risk Mitigation** - Per-streamer tracking

---

## 🔧 Quick Commands

| Task | Command |
|------|----------|
| **Check Dev Status** | `ps aux \| grep tsx` |
| **View Dev Logs** | `cat server.log` |
| **Docker Status** | `docker-compose ps` |
| **Docker Logs** | `npm run docker:logs` |
| **Restart Dev** | `kill $(cat server.pid) && npm run dev` |
| **Restart Docker** | `npm run docker:restart` |

---

## 📝 Documentation

- **Full Guide:** DEPLOYMENT.md
- **Implementation:** IMPLEMENTATION_SUMMARY.md
- **Memory ID:** mzaCEvSj73

---

## ⚡ Current Status

**Development Mode:** ✅ Running (PID 7933)
**Docker Mode:** ⚠️ Not started

**To switch to Docker:**
```bash
kill $(cat /a0/usr/projects/project_1/server.pid)
npm run docker:up
```

**To keep Dev mode:**
Already running! No action needed.

---

**Last Updated:** 2026-02-23  
**Status:** Production Ready ✅
