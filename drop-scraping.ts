import { chromium, Browser, BrowserContext, Page } from 'playwright';
import Database from 'better-sqlite3';

interface DropCampaign {
  id: string;
  name: string;
  game: string;
  requiredMinutes: number;
  currentMinutes: number;
  status: 'active' | 'claimed' | 'expired';
  endDate: string;
  imageUrl?: string;
}

export class DropScrapingService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create campaigns table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drop_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        game TEXT NOT NULL,
        required_minutes INTEGER NOT NULL,
        current_minutes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        end_date TEXT,
        image_url TEXT,
        last_updated TEXT,
        UNIQUE(id)
      )
    `);

    // Create campaign progress table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        campaign_id TEXT NOT NULL,
        minutes_watched INTEGER DEFAULT 0,
        last_claimed TEXT,
        status TEXT DEFAULT 'active',
        UNIQUE(account_id, campaign_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (campaign_id) REFERENCES drop_campaigns(id)
      )
    `);
  }

  async initialize() {
    console.log('Initializing Playwright for drop scraping...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    console.log('Drop scraping browser initialized');
  }

  async scrapeActiveCampaigns(): Promise<DropCampaign[]> {
    if (!this.context) {
      await this.initialize();
    }

    const page = await this.context.newPage();
    const campaigns: DropCampaign[] = [];

    try {
      console.log('Scraping Twitch drop campaigns...');
      await page.goto('https://www.twitch.tv/drops/campaigns', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for campaign cards to load
      await page.waitForSelector('[data-a-target="drops-carousel-item"]', {
        timeout: 15000
      }).catch(() => {
        console.log('No campaigns found or page structure changed');
      });

      // Extract campaign data
      const campaignData = await page.evaluate(() => {
        const results: any[] = [];
        const items = document.querySelectorAll('[data-a-target="drops-carousel-item"]');
        
        items.forEach(item => {
          const nameEl = item.querySelector('[data-a-target="drops-carousel-item-title"]');
          const gameEl = item.querySelector('[data-a-target="drops-game-title"]');
          const progressEl = item.querySelector('[data-a-target="drops-progress-bar"]');
          const imageEl = item.querySelector('img');
          const timeEl = item.querySelector('[data-a-target="drops-time-remaining"]');
          
          if (nameEl && gameEl) {
            // Parse progress (e.g., "15 / 60 mins")
            let currentMinutes = 0;
            let requiredMinutes = 0;
            
            if (progressEl) {
              const progressText = progressEl.textContent || '';
              const match = progressText.match(/(\d+)\s*\/\s*(\d+)\s*mins/);
              if (match) {
                currentMinutes = parseInt(match[1]);
                requiredMinutes = parseInt(match[2]);
              }
            }
            
            // Parse time remaining
            let endDate = '';
            if (timeEl) {
              const timeText = timeEl.textContent || '';
              // Twitch shows time remaining like "2 days" or "5 hours"
              // We'll store this as-is for now
              endDate = timeText;
            }
            
            results.push({
              id: `campaign-${results.length}-${Date.now()}`,
              name: nameEl.textContent || '',
              game: gameEl.textContent || '',
              requiredMinutes,
              currentMinutes,
              status: currentMinutes >= requiredMinutes ? 'completed' : 'active',
              endDate,
              imageUrl: imageEl?.src || ''
            });
          }
        });
        
        return results;
      });

      campaigns.push(...campaignData);
      console.log(`Found ${campaigns.length} active campaigns`);

    } catch (error: any) {
      console.error('Error scraping campaigns:', error.message);
    } finally {
      await page.close();
    }

    return campaigns;
  }

  async updateCampaigns() {
    const campaigns = await this.scrapeActiveCampaigns();
    const now = new Date().toISOString();

    const upsert = this.db.prepare(`
      INSERT INTO drop_campaigns (id, name, game, required_minutes, current_minutes, status, end_date, image_url, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        game = excluded.game,
        required_minutes = excluded.required_minutes,
        current_minutes = excluded.current_minutes,
        status = excluded.status,
        end_date = excluded.end_date,
        image_url = excluded.image_url,
        last_updated = excluded.last_updated
    `);

    for (const campaign of campaigns) {
      upsert.run(
        campaign.id,
        campaign.name,
        campaign.game,
        campaign.requiredMinutes,
        campaign.currentMinutes,
        campaign.status,
        campaign.endDate,
        campaign.imageUrl,
        now
      );
    }

    console.log(`Updated ${campaigns.length} campaigns in database`);
  }

  async updateProgressForAccount(accountId: number) {
    // Get active campaigns
    const campaigns = this.db.prepare('SELECT * FROM drop_campaigns WHERE status = "active"').all() as any[];
    const activeStreams = this.db.prepare('SELECT * FROM active_streams WHERE account_id = ?').all(accountId) as any[];

    for (const campaign of campaigns) {
      // Check if any active stream matches the campaign game
      const matchingStream = activeStreams.find(s => s.game === campaign.game);
      
      if (matchingStream) {
        // Update progress (add 1 minute per check)
        this.db.prepare(`
          INSERT INTO campaign_progress (account_id, campaign_id, minutes_watched, status)
          VALUES (?, ?, 1, 'active')
          ON CONFLICT(account_id, campaign_id) DO UPDATE SET
            minutes_watched = minutes_watched + 1,
            status = CASE
              WHEN minutes_watched + 1 >= ? THEN 'completed'
              ELSE 'active'
            END
        `).run(accountId, campaign.id, campaign.required_minutes);
      }
    }
  }

  async getCampaignsForGame(game: string): Promise<DropCampaign[]> {
    return this.db.prepare(
      'SELECT * FROM drop_campaigns WHERE game LIKE ? AND status = "active"'
    ).all(`%${game}%`) as DropCampaign[];
  }

  async shutdown() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}
