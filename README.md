# Twitch Farm Pro 🎮

![Twitch Farm Pro Dashboard](https://picsum.photos/seed/twitchfarm/1200/600?blur=2)

**Twitch Farm Pro** is an advanced, automated headless farming engine designed to maximize your Twitch Drops, Channel Points, and automated betting strategies across multiple accounts simultaneously. Built with modern web technologies, it features a sleek dashboard, concurrent stream management, and intelligent 20/80 allocation algorithms.

## 🚀 Key Features

*   **Multi-Account Management:** Securely link and manage multiple Twitch accounts using the OAuth 2.0 Device Authorization Grant (Device Flow). No passwords required!
*   **Intelligent 20/80 Allocation:** The background engine automatically splits your concurrent stream capacity (e.g., 10 streams per account). It dedicates 20% to active **Twitch Drops Campaigns** and 80% to your **Followed Channels**.
*   **Automated Drops Farming:** Automatically indexes `twitch.tv/drops/campaigns`. Select the games you want to farm, and the engine will automatically join live streams to progress your drops.
*   **Channel Points & Betting:** Automatically claims channel points on your followed channels. Includes a simulated betting engine that uses strategies like the Kelly Criterion to maximize point gains.
*   **Real-Time Analytics Dashboard:** Monitor total points farmed, drops claimed, active accounts, and system uptime. View a live 24-hour area chart of your farming performance.
*   **Detailed Activity Logs:** Track every action (points claimed, drops progressed, bets placed) with granular logs filtered by account and specific streamer.
*   **Persistent SQLite Storage:** Uses `better-sqlite3` with WAL mode for high-concurrency, ensuring your data, tokens, and settings survive container restarts and deployments.

## 🛠️ Tech Stack

*   **Frontend:** React 19, Vite, Tailwind CSS v4, Recharts, Lucide Icons
*   **Backend:** Node.js, Express, TypeScript
*   **Database:** SQLite (better-sqlite3)
*   **Authentication:** Twitch OAuth 2.0 Device Flow

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/twitch-farm-pro.git
    cd twitch-farm-pro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Twitch Developer Console:**
    *   Go to the [Twitch Developer Console](https://dev.twitch.tv/console).
    *   Register a new application.
    *   Set the **Client Type** to "Public".
    *   Set the **Redirect URI** to `http://localhost:8080` (Required by Twitch for Device Flow, even if unused).
    *   Copy your **Client ID**.

4.  **Start the application:**
    ```bash
    npm run dev
    ```

5.  **Initial Configuration:**
    *   Open the app in your browser (usually `http://localhost:3000`).
    *   Navigate to the **Settings** tab.
    *   Paste your Twitch **Client ID** and save.

## 🎮 How to Use

1.  **Link Accounts:** Go to the **Accounts** tab and click "Add Account". Follow the on-screen instructions to authorize the app via Twitch's Device Flow.
2.  **Configure Games:** Go to the **Campaigns & Games** tab. Click "Index Drops" to fetch current campaigns, then select which games you want the engine to automatically farm.
3.  **Start Farming:** Return to the **Accounts** tab and click the **Play** button next to an account to change its status from `idle` to `farming`.
4.  **Monitor:** Watch the **Dashboard** to see real-time logs and point accumulation!

## ⚠️ Disclaimer

This application is provided for educational and research purposes only. Automating interactions on Twitch may violate their Terms of Service. Use this software at your own risk. The developers are not responsible for any account bans, suspensions, or other actions taken by Twitch.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/twitch-farm-pro/issues).

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Keywords: Twitch Drops Bot, Auto Claim Twitch Drops, Twitch Channel Points Farmer, Automated Twitch Betting, Multi-Account Twitch Bot, Headless Twitch Viewer, React Twitch Dashboard, SQLite Twitch Tracker.*
