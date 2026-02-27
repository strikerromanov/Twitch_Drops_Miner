import { logInfo, logError, logWarn } from './logger';
import type { TwitchTokenResponse, TwitchUser } from './types';

/**
 * Twitch OAuth 2.0 Configuration
 */
const TWITCH_OAUTH_CONFIG = {
  authorizationUrl: 'https://id.twitch.tv/oauth2/authorize',
  tokenUrl: 'https://id.twitch.tv/oauth2/token',
  validateUrl: 'https://id.twitch.tv/oauth2/validate',
  userInfoUrl: 'https://api.twitch.tv/helix/users',
  scopes: [
    'user:read:email',
    'channel:read:subscriptions',
    'channel:read:redemptions'
  ]
};

/**
 * Generate Twitch OAuth 2.0 Authorization URL
 * @param clientId - Twitch client ID
 * @param redirectUri - OAuth redirect URI
 * @param scopes - OAuth scopes (default: email, subs, redemptions)
 * @returns Authorization URL
 */
export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[] = TWITCH_OAUTH_CONFIG.scopes
): string {
  const state = generateState();
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: state,
    force_verify: 'false'
  });
  
  return `${TWITCH_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param code - Authorization code from OAuth callback
 * @param clientId - Twitch client ID
 * @param clientSecret - Twitch client secret
 * @param redirectUri - OAuth redirect URI
 * @returns Token response with access_token, refresh_token, expires_in
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TwitchTokenResponse> {
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const response = await fetch(TWITCH_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logInfo('OAuth token exchanged successfully', {
      token_type: data.token_type,
      expires_in: data.expires_in
    });

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type
    };
  } catch (error) {
    logError('Failed to exchange code for token', { code }, error as Error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token from previous OAuth flow
 * @param clientId - Twitch client ID
 * @param clientSecret - Twitch client secret
 * @returns New token response with refreshed access_token and refresh_token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TwitchTokenResponse> {
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await fetch(TWITCH_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logInfo('OAuth token refreshed successfully');

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type
    };
  } catch (error) {
    logError('Failed to refresh access token', {}, error as Error);
    throw error;
  }
}

/**
 * Validate access token with Twitch API
 * @param token - Access token to validate
 * @returns Token validation response with client_id, scopes, expires_in
 */
export async function validateToken(token: string): Promise<{
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch(TWITCH_OAUTH_CONFIG.validateUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      logWarn('Token validation failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logError('Failed to validate token', {}, error as Error);
    return null;
  }
}

/**
 * Get user info from Twitch API using access token
 * @param accessToken - Valid access token
 * @returns User information including id, login, display_name
 */
export async function getUserInfo(accessToken: string): Promise<TwitchUser | null> {
  try {
    const response = await fetch(TWITCH_OAUTH_CONFIG.userInfoUrl, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID || '',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No user data returned');
    }

    const user = data.data[0];
    return {
      id: user.id,
      login: user.login,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url
    };
  } catch (error) {
    logError('Failed to get user info', {}, error as Error);
    return null;
  }
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 * @param expiresAt - Token expiration timestamp (Unix epoch seconds)
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  const buffer = 300; // 5 minutes buffer
  return (now + buffer) >= expiresAt;
}

/**
 * Generate random state parameter for OAuth flow
 * @returns Random state string
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
