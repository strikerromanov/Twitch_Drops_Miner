# 🚀 Twitch Drops Miner - Unraid Deployment

**🎯 Target URL:** http://192.168.1.99:5173
**📦 Status:** Production Ready
**📅 Last Updated:** 2026-02-23

---

## 🎮 What is This?

**Twitch Drops Miner** is an automated farming bot that:
- ✅ Auto-claims channel points every 5 minutes
- ✅ Places algorithmic bets using Kelly Criterion
- ✅ Manages 20/80 allocation for drops vs favorites
- ✅ Tracks analytics and win rates per streamer
- ✅ Implements risk mitigation strategies

---

## 📋 Quick Start (Unraid)

### **Step 1: Copy Files to Unraid**

1. **Access your Unraid server** via SMB or Unraid web UI
2. **Copy the entire project folder** to:
   ```
   /mnt/user/appdata/twitch-drops-miner/
   ```

3. **Required files:**
   - ✅ Dockerfile
   - ✅ docker-compose-unraid.yml
   - ✅ package.json
   - ✅ server.ts
   - ✅ src/ (all source files)

### **Step 2: Deploy via Unraid Terminal**

1. **Open Unraid Terminal** (or SSH)
2. **Navigate to project:**
   ```bash
   cd /mnt/user/appdata/twitch-drops-miner
   ```

3. **Build and start:**
   ```bash
   docker-compose -f docker-compose-unraid.yml build
   docker-compose -f docker-compose-unraid.yml up -d
   ```

### **Step 3: Access Application**

**🎯 Open in Browser:** http://192.168.1.99:5173

---

## 🎯 First Time Setup

1. **Configure Twitch API**
   - Go to **Settings** → **Twitch API Configuration**
   - Enter your **Twitch Client ID**
   - Click **Save Changes**

2. **Add Your Account**
   - Go to **Accounts** tab
   - Click **Add Account**
   - Follow OAuth Device Flow

3. **Start Farming**
   - Toggle account to **Farming** status
   - Watch points accumulate!

---

## 📊 Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Point Claiming** | ✅ Active | Auto-claim every 5 minutes |
| **Betting Engine** | ✅ Ready | Kelly Criterion strategy |
| **20/80 Allocation** | ✅ Active | Drops vs Favorites split |
| **Analytics** | ✅ Live | Real-time dashboard |
| **Risk Mitigation** | ✅ Active | Per-streamer tracking |

---

## 🔧 Management

### **Start/Stop/Restart:**
```bash
# Start
docker-compose -f docker-compose-unraid.yml up -d

# Stop
docker-compose -f docker-compose-unraid.yml down

# Restart
docker-compose -f docker-compose-unraid.yml restart

# View logs
docker-compose -f docker-compose-unraid.yml logs -f
```

### **Unraid Web UI:**
1. Go to **Docker** tab
2. Find `twitch-drops-miner` container
3. Use controls to start/stop/restart
4. Click **Log** button to view logs

---

## 📁 File Structure (Unraid)

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

## 🔒 Security

- **Port:** 5173 (external) → 3000 (internal)
- **Network:** bridge mode
- **Volumes:** Persisted in appdata
- **Restart:** unless-stopped

---

## 📝 Documentation

- **UNRAID_DEPLOYMENT.md** - Detailed deployment guide
- **DEPLOYMENT.md** - General deployment documentation
- **IMPLEMENTATION_SUMMARY.md** - Feature documentation
- **QUICK_START.md** - Quick reference guide

---

## ✅ Deployment Checklist

- [ ] Unraid Docker enabled
- [ ] Port 5173 available
- [ ] Project files copied to `/mnt/user/appdata/twitch-drops-miner/`
- [ ] Container built and started
- [ ] Web UI accessible at http://192.168.1.99:5173
- [ ] Twitch Client ID configured
- [ ] Test account added
- [ ] Farming started

---

## 🎉 Success Indicators

✅ Container: Running in Docker tab  
✅ Web UI: Accessible at http://192.168.1.99:5173  
✅ Logs: Show "Server running on http://localhost:3000"  
✅ Features: All enhanced features loaded

---

**Ready to deploy on Unraid!** 🚀

For detailed instructions, see **UNRAID_DEPLOYMENT.md**
