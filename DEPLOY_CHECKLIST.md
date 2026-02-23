# ✅ Unraid Deployment Checklist

**🎯 Target:** http://192.168.1.99:5173
**📦 Application:** Twitch Drops Miner
**📅 Date:** 2026-02-23

---

## 📁 Files to Transfer to Unraid

### **Required Files:**
```
/mnt/user/appdata/twitch-drops-miner/
├── Dockerfile                      ✅ Required
├── docker-compose-unraid.yml       ✅ Required (Unraid-specific)
├── package.json                    ✅ Required
├── package-lock.json               ✅ Required
├── server.ts                       ✅ Required
├── tsconfig.json                   ✅ Required
├── vite.config.ts                  ✅ Required
├── .dockerignore                   ✅ Optional (recommended)
├── README_UNRAID.md                ✅ Reference
└── src/                            ✅ Required (entire folder)
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    └── components/
        ├── Accounts.tsx
        ├── Betting.tsx
        ├── Campaigns.tsx
        ├── Dashboard.tsx
        └── Settings.tsx
```

### **Optional Files (Documentation):**
```
├── UNRAID_DEPLOYMENT.md
├── DEPLOYMENT.md
├── IMPLEMENTATION_SUMMARY.md
└── QUICK_START.md
```

---

## 🚀 Deployment Steps

### **1. Copy Files to Unraid**

**Option A: Via SMB (Windows Share)**
```
\\YOUR_UNRAID_IP\appdata\twitch-drops-miner\
```

**Option B: Via Unraid Web UI**
1. Open Unraid: http://192.168.1.99
2. Go to **Main** → **appdata** share
3. Create folder: `twitch-drops-miner`
4. Upload all files

**Option C: Via SCP/SSH**
```bash
scp -r /a0/usr/projects/project_1/* root@192.168.1.99:/mnt/user/appdata/twitch-drops-miner/
```

### **2. Deploy Container**

**Access Unraid Terminal:**
1. SSH into Unraid OR
2. Use Unraid web UI: **Settings** → **Terminal**

**Run Commands:**
```bash
# Navigate to project
cd /mnt/user/appdata/twitch-drops-miner

# Build Docker image
docker-compose -f docker-compose-unraid.yml build

# Start container
docker-compose -f docker-compose-unraid.yml up -d

# Check status
docker ps | grep twitch-drops-miner
```

### **3. Verify Deployment**

**Check Container Status:**
```bash
docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE                     COMMAND             CREATED
123456789abc   twitch-drops-miner        "npm run start"    2 min ago
```

**Check Logs:**
```bash
docker logs -f twitch-drops-miner
```

**Expected Output:**
```
Server running on http://localhost:3000
Enhanced features loaded: Point Claiming, Betting Engine, 20/80 Allocation
```

---

## 🌐 Access Application

**Web Interface:**
```
http://192.168.1.99:5173
```

**API Test:**
```bash
curl http://192.168.1.99:5173/api/stats
```

---

## 🎯 First Time Configuration

1. **Open:** http://192.168.1.99:5173
2. **Settings** → **Twitch API Configuration**
3. **Enter** Twitch Client ID
4. **Save Changes**
5. **Accounts** → **Add Account**
6. **Toggle** to **Farming** status
7. **Watch** points accumulate!

---

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't access http://192.168.1.99:5173 | Check if container is running: `docker ps` |
| Container won't start | Check logs: `docker logs twitch-drops-miner` |
| Build fails | Ensure all files are transferred correctly |
| Port 5173 not accessible | Check Unraid firewall settings |

---

## 📋 Verification Checklist

- [ ] All required files copied to `/mnt/user/appdata/twitch-drops-miner/`
- [ ] Docker image built successfully
- [ ] Container started and running
- [ ] Logs show "Server running on http://localhost:3000"
- [ ] Web UI accessible at http://192.168.1.99:5173
- [ ] API responds to `/api/stats`
- [ ] Can access Settings page
- [ ] Can add Twitch account
- [ ] Farming can be started

---

## 🎉 Success!

Once deployed, you'll have:

✅ Automated point farming (every 5 minutes)
✅ Algorithmic betting (Kelly Criterion)
✅ 20/80 drop allocation
✅ Real-time analytics
✅ Risk mitigation

---

**Ready to deploy on Unraid!** 🚀

For detailed instructions, see **UNRAID_DEPLOYMENT.md**
