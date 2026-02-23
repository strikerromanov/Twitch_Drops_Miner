# Twitch Drops Miner - Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-23  
**Status:** Production Ready ✅

---

## 📋 Overview

This application supports **two deployment methods**:

1. **Development Mode** - Running inside Agent Zero container (current setup)
2. **Docker Mode** - Isolated production container

Both methods use the same codebase and database.

---

## 🚀 Quick Start

### **Option A: Development Mode (Current)**

Already running inside Agent Zero container:

```bash
cd /a0/usr/projects/project_1
npm run dev
```

**Access:** http://localhost:3000

---

### **Option B: Docker Mode (Production)**

Build and run in isolated container:

```bash
# Build the image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

**Access:** http://localhost:3000

---

## 📦 Docker Deployment

### **Prerequisites**

- Docker 20.10+
- Docker Compose 2.0+

### **Step 1: Build the Image**

```bash
cd /a0/usr/projects/project_1
docker-compose build
```

**Build Output:**
```
[+] Building 245.3s (18/18) FINISHED
=> => naming to twitch-drops-miner
```

### **Step 2: Start the Container**

```bash
docker-compose up -d
```

**Expected Output:**
```
[+] Running 2/2
 ✔ Network twitch-network      Created
 ✔ Container twitch-drops-miner  Started
```

### **Step 3: Verify Deployment**

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs -f

# Test API
curl http://localhost:3000/api/stats
```

---

## 🔧 Docker Management

### **Start**
```bash
docker-compose up -d
```

### **Stop**
```bash
docker-compose down
```

### **Restart**
```bash
docker-compose restart
```

### **View Logs**
```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### **Shell Access**
```bash
docker-compose exec twitch-drops-miner sh
```

### **Database Backup**
```bash
# Backup database
docker-compose exec twitch-drops-miner cp /app/data/farm.db /app/data/backup_$(date +%Y%m%d).db

# Copy to host
docker-compose cp twitch-drops-miner:/app/data/backup_$(date +%Y%m%d).db ./backup_
```

---

## 🔌 Configuration

### **Environment Variables**

Create `.env` file in project root:

```env
NODE_ENV=production
PORT=3000
```

### **Port Mapping**

To change external port (e.g., 8080):

```yaml
# docker-compose.yml
ports:
  - "8080:3000"
```

### **Volume Mounts**

Data is persisted in:
- `./data` - Database files
- `./logs` - Application logs

---

## 📊 Monitoring

### **Health Check**

Docker includes automatic health checks:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' twitch-drops-miner
```

### **Metrics**

Monitor via Dashboard:
- Total Points
- Active Accounts
- Chat Connections
- Bet Performance

---

## 🐛 Troubleshooting

### **Docker Issues**

| Problem | Solution |
|---------|----------|
| Port already in use | Change port mapping in docker-compose.yml |
| Container won't start | Check logs: `docker-compose logs` |
| Database errors | Ensure `./data` directory exists and is writable |
| Can't access web UI | Verify port mapping and firewall settings |

### **Development Mode Issues**

| Problem | Solution |
|---------|----------|
| Server not running | Check `cat server.log` |
| Port conflict | Kill existing process: `kill $(cat server.pid)` |
| Module not found | Run `npm install` |

---

## 🔄 Switching Between Modes

### **Dev → Docker**

```bash
# Stop dev server
cd /a0/usr/projects/project_1
kill $(cat server.pid) 2>/dev/null

# Start Docker
docker-compose up -d
```

### **Docker → Dev**

```bash
# Stop Docker
docker-compose down

# Start dev server
npm run dev
```

---

## 🔒 Security

### **Production Recommendations**

1. **Use HTTPS** - Add reverse proxy (nginx/traefik)
2. **Limit Resources** - Add to docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```
3. **Database Backups** - Schedule regular backups
4. **Update Dependencies** - Regular `npm audit fix`

---

## 📈 Performance Tuning**

### **Database Optimization**

SQLite is already configured with WAL mode for high concurrency.

### **Rate Limiting**

Adjust claim intervals in Settings:
- Point Claiming: 5-30 minutes
- Stream Checking: 30 seconds (fixed)
- Betting: 15 minutes (when enabled)

---

## 🌐 External Access

### **Local Network**

Find your IP:
```bash
# Linux
hostname -I

# Access via
http://YOUR_IP:3000
```

### **Remote Access**

Options:
1. **SSH Tunnel:** `ssh -L 3000:localhost:3000 user@server`
2. **VPN:** Use Tailscale/WireGuard
3. **Reverse Proxy:** nginx with SSL

---

## 📝 Maintenance

### **Updates**

```bash
# Pull latest code
git pull

# Rebuild Docker
docker-compose build --no-cache

# Restart
docker-compose up -d
```

### **Cleanup**

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Remove images
docker rmi twitch-drops-miner
```

---

## ✅ Pre-Flight Checklist

Before deploying to production:

- [ ] Twitch Client ID configured
- [ ] Test account added and verified
- [ ] Settings reviewed and adjusted
- [ ] Database backup scheduled
- [ ] Monitoring set up
- [ ] HTTPS configured (if external access)
- [ ] Resource limits set
- [ ] Logs rotation configured

---

## 🎯 Best Practices

1. **Start with dev mode** for testing
2. **Use Docker** for production
3. **Regular backups** of database
4. **Monitor logs** for issues
5. **Keep dependencies** updated
6. **Use conservative settings** initially
7. **Gradually increase** bet percentages

---

## 📞 Support

- **Memory ID:** mzaCEvSj73
- **Documentation:** IMPLEMENTATION_SUMMARY.md
- **Issues:** Check logs first

---

**Last Updated:** 2026-02-23  
**Status:** Production Ready ✅
