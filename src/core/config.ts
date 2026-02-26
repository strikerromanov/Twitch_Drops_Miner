/**
 * Centralized configuration for Twitch Drops Miner
 * Loads environment variables and provides validated config object
 */

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

/**
 * Node environment (development, production, test)
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Server port
 */
export const PORT = parseInt(process.env.PORT || '3000', 10);

/**
 * Twitch OAuth Client ID
 */
export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

/**
 * Twitch OAuth Client Secret
 */
export const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

/**
 * Twitch OAuth Redirect URI
 */
export const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback';

/**
 * Twitch OAuth scopes
 */
export const TWITCH_SCOPES = [
  'user:read:email',
  'channel:read:subscriptions',
  'user:read:subscriptions',
  'chat:read',
  'chat:edit',
  'channel:moderate',
  'whispers:read',
  'whispers:edit'
];

// ============================================
// TWITCH API CONSTANTS
// ============================================

/**
 * Twitch API base URL
 */
export const TWITCH_API_URL = 'https://api.twitch.tv/helix';

/**
 * Twitch OAuth URL
 */
export const TWITCH_OAUTH_URL = 'https://id.twitch.tv/oauth2';

/**
 * Twitch PubSub URL
 */
export const TWITCH_PUBSUB_URL = 'wss://pubsub-edge.twitch.tv';

/**
 * Twitch TMI (IRC) URL
 */
export const TWITCH_TMI_URL = 'irc://irc.chat.twitch.tv:6667';

/**
 * Twitch TMI SSL URL
 */
export const TWITCH_TMI_SSL_URL = 'wss://irc-ws.chat.twitch.tv:443';

/**
 * Authorization endpoint
 */
export const TWITCH_AUTH_URL = `${TWITCH_OAUTH_URL}/authorize`;

/**
 * Token endpoint
 */
export const TWITCH_TOKEN_URL = `${TWITCH_OAUTH_URL}/token`;

/**
 * Validate endpoint
 */
export const TWITCH_VALIDATE_URL = `${TWITCH_OAUTH_URL}/validate`;

// ============================================
// SERVICE INTERVALS (milliseconds)
// ============================================

/**
 * Drop check interval - how often to check for new drops
 */
export const DROP_CHECK_INTERVAL = parseInt(process.env.DROP_CHECK_INTERVAL || '300000', 10); // 5 minutes

/**
 * Point claim interval - how often to claim channel points
 */
export const POINT_CLAIM_INTERVAL = parseInt(process.env.POINT_CLAIM_INTERVAL || '60000', 10); // 1 minute

/**
 * Chat farming interval - how often to send chat messages
 */
export const CHAT_FARMING_INTERVAL = parseInt(process.env.CHAT_FARMING_INTERVAL || '30000', 10); // 30 seconds

/**
 * Stream check interval - how often to check stream status
 */
export const STREAM_CHECK_INTERVAL = parseInt(process.env.STREAM_CHECK_INTERVAL || '120000', 10); // 2 minutes

/**
 * Token refresh interval - how often to check for expiring tokens
 */
export const TOKEN_REFRESH_CHECK_INTERVAL = parseInt(process.env.TOKEN_REFRESH_CHECK_INTERVAL || '3600000', 10); // 1 hour

/**
 * Betting check interval - how often to check for betting opportunities
 */
export const BETTING_CHECK_INTERVAL = parseInt(process.env.BETTING_CHECK_INTERVAL || '60000', 10); // 1 minute

// ============================================
// SERVICE LIMITS
// ============================================

/**
 * Maximum concurrent streams per account
 */
export const MAX_CONCURRENT_STREAMS = parseInt(process.env.MAX_CONCURRENT_STREAMS || '3', 10);

/**
 * Maximum accounts to process simultaneously
 */
export const MAX_PARALLEL_ACCOUNTS = parseInt(process.env.MAX_PARALLEL_ACCOUNTS || '5', 10);

/**
 * Maximum drop campaigns to track
 */
export const MAX_DROP_CAMPAIGNS = 100;

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Enable drop mining
 */
export const ENABLE_DROPS = process.env.ENABLE_DROPS !== 'false';

/**
 * Enable betting feature
 */
export const ENABLE_BETTING = process.env.ENABLE_BETTING !== 'false';

/**
 * Enable chat farming
 */
export const ENABLE_CHAT_FARMING = process.env.ENABLE_CHAT_FARMING !== 'false';

/**
 * Enable point claiming
 */
export const ENABLE_POINT_CLAIMING = process.env.ENABLE_POINT_CLAIMING !== 'false';

// ============================================
// BETTING SETTINGS
// ============================================

/**
 * Default bet percentage (0-100)
 */
export const BET_PERCENTAGE = parseInt(process.env.BET_PERCENTAGE || '10', 10);

/**
 * Minimum streamer viewers for betting
 */
export const BETTING_MIN_VIEWERS = parseInt(process.env.BETTING_MIN_VIEWERS || '100', 10);

/**
 * Minimum win rate to consider betting
 */
export const BETTING_MIN_WIN_RATE = parseFloat(process.env.BETTING_MIN_WIN_RATE || '0.45');

/**
 * Maximum loss streak before stopping betting
 */
export const MAX_LOSS_STREAK = parseInt(process.env.MAX_LOSS_STREAK || '5', 10);

// ============================================
// LOGGING CONFIGURATION
// ============================================

/**
 * Log level (error, warn, info, debug)
 */
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Log file path
 */
export const LOG_FILE_PATH = process.env.LOG_FILE_PATH || './logs/app.log';

/**
 * Maximum log file size (bytes)
 */
export const MAX_LOG_SIZE = parseInt(process.env.MAX_LOG_SIZE || '10485760', 10); // 10MB

/**
 * Maximum number of log files to keep
 */
export const MAX_LOG_FILES = parseInt(process.env.MAX_LOG_FILES || '5', 10);

// ============================================
// VALIDATION
// ============================================

/**
 * Validate required configuration
 * Throws error if required config is missing
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!TWITCH_CLIENT_ID) {
    errors.push('TWITCH_CLIENT_ID is required');
  }

  if (!TWITCH_CLIENT_SECRET) {
    errors.push('TWITCH_CLIENT_SECRET is required');
  }

  if (PORT < 1 || PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (BET_PERCENTAGE < 0 || BET_PERCENTAGE > 100) {
    errors.push('BET_PERCENTAGE must be between 0 and 100');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Export all configuration as a single object
 */
export const config = {
  env: NODE_ENV,
  port: PORT,
  twitch: {
    clientId: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_CLIENT_SECRET,
    redirectUri: TWITCH_REDIRECT_URI,
    scopes: TWITCH_SCOPES,
    apiUrl: TWITCH_API_URL,
    oauthUrl: TWITCH_OAUTH_URL,
    pubsubUrl: TWITCH_PUBSUB_URL,
    tmiUrl: TWITCH_TMI_URL,
    tmiSslUrl: TWITCH_TMI_SSL_URL
  },
  intervals: {
    dropCheck: DROP_CHECK_INTERVAL,
    pointClaim: POINT_CLAIM_INTERVAL,
    chatFarming: CHAT_FARMING_INTERVAL,
    streamCheck: STREAM_CHECK_INTERVAL,
    tokenRefresh: TOKEN_REFRESH_CHECK_INTERVAL,
    bettingCheck: BETTING_CHECK_INTERVAL
  },
  limits: {
    maxConcurrentStreams: MAX_CONCURRENT_STREAMS,
    maxParallelAccounts: MAX_PARALLEL_ACCOUNTS,
    maxDropCampaigns: MAX_DROP_CAMPAIGNS
  },
  features: {
    drops: ENABLE_DROPS,
    betting: ENABLE_BETTING,
    chatFarming: ENABLE_CHAT_FARMING,
    pointClaiming: ENABLE_POINT_CLAIMING
  },
  betting: {
    percentage: BET_PERCENTAGE,
    minViewers: BETTING_MIN_VIEWERS,
    minWinRate: BETTING_MIN_WIN_RATE,
    maxLossStreak: MAX_LOSS_STREAK
  },
  logging: {
    level: LOG_LEVEL,
    filePath: LOG_FILE_PATH,
    maxSize: MAX_LOG_SIZE,
    maxFiles: MAX_LOG_FILES
  }
};

/**
 * Get configuration object
 */
export function getConfig() {
  return config;
}
