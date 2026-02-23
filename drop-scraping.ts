// Drop Campaign Scraping Service
// Scrapes Twitch drop campaigns using Playwright
import { chromium } from 'playwright';
import Database from 'better-sqlite3';

interface DropCampaign {
  id: string;
  name: string;
  game: string;
  requiredMinutes: number;
  currentMinutes: number;
  status: string;
}

export class DropScrapingService {
  private browser: any = null;
  private page: any = null;
  private enabled: boolean = true;
  private db: Database.Database;
  
  constructor(db: Database.Database) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Playwright for drop scraping...');
      
      // Try to launch browser
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.page = await this.browser.newPage();
      console.log('✅ Playwright browser for drop scraping initialized');
    } catch (error: any) {
      console.warn('⚠️  Drop scraping Playwright initialization failed:', error.message);
      console.warn('ℹ️  Drop scraping will be disabled. Manual drop configuration available.');
      this.enabled = false;
      this.browser = null;
      this.page = null;
    }
  }

  async scrapeDropCampaigns(): Promise<DropCampaign[]> {
    if (!this.enabled || !this.page) {
      console.log('Drop scraping disabled, returning empty campaigns list');
      return [];
    }

    try {
      await this.page.goto('https://www.twitch.tv/drops/campaigns');
      await this.page.waitForTimeout(3000);
      
      // Extract campaign data
      const campaigns = await this.page.evaluate(() => {
        const cards = document.querySelectorAll('.drop-card');
        return Array.from(cards).map(card => ({
          id: card.getAttribute('data-campaign-id') || '',
          name: card.querySelector('.campaign-name')?.textContent || '',
          game: card.querySelector('.game-name')?.textContent || '',
          requiredMinutes: parseInt(card.querySelector('.required-minutes')?.textContent || '0'),
          currentMinutes: 0,
          status: 'active'
        }));
      });
      
      console.log(`Scraped ${campaigns.length} drop campaigns`);
      return campaigns;
    } catch (error) {
      console.error('Error scraping drop campaigns:', error);
      return [];
    }
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('Drop scraping browser closed');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
