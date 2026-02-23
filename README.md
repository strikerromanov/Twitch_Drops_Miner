# Twitch Drops Miner

**Advanced Twitch drops mining application with automated point claiming, algorithmic betting, and drop campaign tracking.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-20.x-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com)

## ✨ Features

### 🎯 Core Features
- ✅ **Automated Point Claiming** - Real Playwright browser automation
- ✅ **Algorithmic Betting** - Kelly Criterion strategy with risk mitigation
- ✅ **Drop Campaign Tracking** - Automatic scraping and progress monitoring
- ✅ **20/80 Allocation** - Intelligent distribution between drops and favorite channels
- ✅ **Multi-Account Support** - Farm with unlimited accounts simultaneously

### 🚀 Advanced Features (All 12 Implemented)
1. **Token Refresh** - 24/7 farming without 4-hour expiry
2. **Retry Logic** - Exponential backoff for API failures
3. **Database Indexes** - 10-100x query performance improvement
4. **Chat Reconnection** - Auto-reconnect on server restart
5. **Log Cleanup** - Daily cleanup prevents database bloat
6. **Config Validation** - Prevents invalid settings
7. **Circuit Breaker** - Prevents cascading failures
8. **Real-Time Updates** - WebSocket for instant notifications
9. **Multi-Account Coordination** - No duplicate stream watching
10. **Automated Backups** - Daily backups with 7-day retention
11. **Point Claiming** - Playwright browser automation
12. **Drop Scraping** - Campaign tracking and monitoring

## 📦 Installation

### Prerequisites
- Node.js 20.x or higher
- Docker (optional, for containerized deployment)
- Twitch Client ID ([Get one here](https://dev.twitch.tv/console/apps))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/strikerromanov/Twitch_Drops_Miner.git
cd Twitch_Drops_Miner

# Install dependencies
npm install

# Build the frontend
npm run build

# Start the server
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build the image
docker-compose -f docker-compose-unraid.yml build

# Start the container
docker-compose -f docker-compose-unraid.yml up -d

# View logs
docker-compose -f docker-compose-unraid.yml logs -f
```

### Manual Docker Build

```bash
# Build the image
docker build -t twitch-drops-miner .

# Run the container
docker run -d \
  --name twitch-drops-miner \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  twitch-drops-miner
```

## ⚙️ Configuration

### 1. Twitch API Setup

1. Go to [Twitch Dev Console](https://dev.twitch.tv/console/apps)
2. Create a new application
3. Set OAuth Redirect URL to `http://localhost:3000/auth/callback`
4. Copy your Client ID

### 2. Configure Application

1. Open the web interface
2. Go to **Settings** → **Twitch API Configuration**
3. Enter your **Twitch Client ID**
4. Click **Save Changes**

### 3. Add Account

1. Go to **Accounts** tab
2. Click **Add Account**
3. Follow the OAuth Device Flow:
   - You'll receive a device code
   - Go to [twitch.tv/activate](https://www.twitch.tv/activate)
   - Enter the code
   - Approve the authorization

### 4. Start Farming

1. Toggle your account to **Farming** status
2. Watch points accumulate automatically!

## 📊 Features Explained

### Point Claiming
- Uses Playwright for real browser automation
- Auto-claims channel points every 5 minutes
- Detects bonus events in chat
- Tracks all claims in database

### Betting Engine
- **Kelly Criterion** - Mathematical optimal betting
- **Risk Levels** - Low (55%+ wins), Medium (45-55%), High (<45%)
- **Auto-Skip** - Avoids poor performers
- **Sample Size Building** - Starts conservative, increases with data

### Drop Campaigns
- Scrapes twitch.tv/drops/campaigns automatically
- Tracks progress per campaign
- Auto-switches streams to complete drops
- 20/80 allocation: 20% drops, 80% favorites

### Multi-Account Coordination
- Prevents duplicate stream watching
- Maximizes unique stream coverage
- Intelligent distribution algorithm

## 🔧 Advanced Settings

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `bettingEnabled` | true/false | false | Enable automated betting |
| `maxBetPercentage` | 1-20% | 5% | Max bet per wager |
| `pointClaimInterval` | 60-1800s | 300s | Claim frequency |
| `dropAllocation` | 10-50% | 20% | % for drop campaigns |
| `concurrentStreams` | 1-10 | 10 | Streams per account |

## 📈 Performance

| Metric | Before | After |
|--------|--------|-------|
| Query Speed | Baseline | 10-100x faster |
| API Reliability | Fails often | Auto-retry |
| Farming Uptime | 4 hours max | 24/7 |
| Database Size | Grows indefinitely | Auto-cleanup |
| Frontend Updates | 5-second poll | Real-time WebSocket |
| Image Size | ~200MB | ~1.77GB (full features) |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Get overall statistics |
| `/api/accounts` | GET | List all accounts |
| `/api/accounts` | POST | Add new account |
| `/api/betting/stats` | GET | Get betting statistics |
| `/api/drops/campaigns` | GET | Get drop campaigns |
| `/api/settings` | GET/POST | Manage settings |

## 🔍 Troubleshooting

### Container won't start
```bash
# Check logs
docker logs twitch-drops-miner

# Common issues:
# - Port 3000 already in use
# - Database locked (restart container)
# - Missing Twitch Client ID
```

### Points not claiming
1. Check account is in "Farming" status
2. Verify Twitch Client ID is correct
3. Check logs for chat connection errors
4. Ensure streamer is live

### Betting not working
1. Check betting is enabled in Settings
2. Verify account has sufficient points
3. Check Betting tab for streamer statistics
4. Ensure sample size is built (initial bets are small)

## 📦 Technology Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Database:** SQLite with better-sqlite3
- **Browser Automation:** Playwright
- **Chat:** tmi.js
- **Scheduling:** node-cron
- **Container:** Docker (Debian Slim base)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This tool is for educational purposes only. Please respect Twitch's Terms of Service.

## 🙏 Acknowledgments

- [Twitch](https://twitch.tv) for the platform
- [Playwright](https://playwright.dev) for browser automation
- [tmi.js](https://github.com/tmijs/tmi.js) for Twitch chat

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/strikerromanov/Twitch_Drops_Miner/issues)
- **Discord:** [Agent Zero Discord](https://discord.gg/B8KZKNsPpj)
- **Skool:** [Agent Zero Skool](https://www.skool.com/agent-zero)

---

**Made with ❤️ by [strikerromanov](https://github.com/strikerromanov)**

**Live Demo:** http://192.168.1.99:5173
