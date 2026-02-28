/**
 * Core TypeScript interfaces for Twitch Drops Miner
 * All properties use snake_case to match database schema
 */

// ============================================
// ACCOUNT TYPES
// ============================================

/**
 * Represents a Twitch account in the system
 */
export interface Account {
  id: number;
  username: string | null;
  access_token: string | null;
  refresh_token: string | null;
  status: AccountStatus;
  createdAt: string;
  lastActive: string | null;
  last_active?: string | null;  // Alias for compatibility
  user_id: string | null;
  points_balance?: number;  // Current points balance
}

/**
 * Possible account statuses
 */
export type AccountStatus = 'idle' | 'active' | 'inactive' | 'error' | 'banned';

// ============================================
// SETTINGS TYPES
// ============================================

/**
 * Application setting key-value pair
 */
export interface Setting {
  key: string;
  value: string;
}

/**
 * Application configuration settings
 */
export interface Settings {
  // Twitch OAuth
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  
  // Service settings
  drop_check_interval?: number;
  point_claim_interval?: number;
  chat_farming_interval?: number;
  
  // Feature flags
  enable_drops?: boolean;
  enable_betting?: boolean;
  enable_chat_farming?: boolean;
  
  // Limits
  max_concurrent_streams?: number;
  bet_percentage?: number;
}

// ============================================
// LOG TYPES
// ============================================

/**
 * Application log entry
 */
export interface Log {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
  streamer_id: number | null;
  type: string | null;
}

/**
 * Log severity levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// ============================================
// DROP CAMPAIGN TYPES
// ============================================

/**
 * Twitch drop campaign
 */
/**
 * Game information
 */
export interface Game {
  id: string;
  name: string;
  genres?: string[];
}

/**
 * Drop campaign information
 */
export interface DropCampaign {
  id: string;
  name: string;
  game: Game | string;  // Can be object or string
  required_minutes: number;
  required_minutes_watch_time?: number;  // Alias for UI compatibility
  current_minutes: number;
  status: CampaignStatus;
  image_url: string | null;
  last_updated: string;
  ends_at?: string | null;  // Campaign end time
  allowed_channels?: string[];  // Channels eligible for drops
}

/**
 * Campaign status
 */
export type CampaignStatus = 'active' | 'claimed' | 'expired' | 'upcoming';

/**
 * Drop progress for a specific account
 */
export interface DropProgress {
  id: number;
  account_id: number;
  campaign_id: string;
  current_minutes: number;
  last_updated: string;
}

// ============================================
// STREAM TYPES
// ============================================

/**
 * Active stream being watched by an account
 */
export interface ActiveStream {
  id: number;
  account_id: number;
  streamer: string;
  game: string;
  viewer_count: number;
  started_at: string;
}

/**
 * Stream allocation for an account
 */
export interface StreamAllocation {
  account_id: number;
  streamer: string;
  assigned_at: string;
}

/**
 * Followed channel information
 */
export interface FollowedChannel {
  id: number;
  account_id: number;
  streamer: string;
  streamer_id: string;
  status: string;
  game_name: string | null;
  viewer_count: number;
  points: number;
  bets: number;
}

// ============================================
// BETTING TYPES
// ============================================

/**
 * Betting statistics for a streamer
 */
export interface BettingStats {
  id: number;
  streamer: string;
  totalBets: number;
  wins: number;
  totalProfit: number;
  avgOdds: number;
}

/**
 * Individual bet history record
 */
export interface BettingHistory {
  id: number;
  account_id: number;
  streamer: string;
  amount: number;
  outcome: BetOutcome;
  profit: number;
  bet_time: string;
  strategy: string | null;
}

/**
 * Bet outcome result
 */
export type BetOutcome = 'win' | 'loss' | 'pending' | 'refunded';

// ============================================
// GAME TYPES
// ============================================

/**
 * Game information
 */
export interface Game {
  // id: number; // Duplicate - removed
  name: string;
  activeCampaigns: number;
  whitelisted: number;
  lastDrop: string | null;
}

// ============================================
// POINT CLAIMING TYPES
// ============================================

/**
 * Point claim history record
 */
export interface PointClaimHistory {
  id: number;
  account_id: number;
  streamer: string;
  points_claimed: number;
  claimed_at: string;
  bonus_type: string | null;
}

// ============================================
// TMI CHAT TYPES
// ============================================

/**
 * TMI chat connection status
 */
export interface TmiChatStatus {
  account_id: number;
  connected: number;
  channel: string | null;
  last_connected: string | null;
}

// ============================================
// ANALYSIS TYPES
// ============================================

/**
 * Streamer analysis data (for betting/farming optimization)
 */
export interface StreamerAnalysis {
  id: number;
  streamer_id: string;
  streamer: string;
  time: string;
  type: AnalysisType;
  data: string; // JSON string
}

/**
 * Type of analysis record
 */
export type AnalysisType = 'betting_pattern' | 'drop_progress' | 'viewer_stats' | 'engagement';

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Twitch OAuth token response
 */
export interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Twitch user information
 */
export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

/**
 * Twitch stream information
 */
export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  is_live: boolean;
}

/**
 * Twitch drop campaign from API
 */
export interface TwitchDropCampaign {
  id: string;
  name: string;
  game: {
    id: string;
    name: string;
  };
  required_minutes_watch: number;
  start_time: string;
  end_time: string;
  image_url: string;
}

export interface BettingStats {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsWon: number;
  pointsLost: number;
  netProfit: number;
}

export interface RecentBet {
  id: number;
  account_id: number;
  streamer_name: string;
  prediction_title: string;
  outcome_selected: string;
  outcome_percentage: number;
  points_wagered: number;
  points_won: number;
  timestamp: string;
}

export interface PredictionEvent {
  id: string;
  streamerName: string;
  title: string;
  outcome1: string;
  outcome1Percentage: number;
  outcome2: string;
  outcome2Percentage: number;
  points: number;
}
