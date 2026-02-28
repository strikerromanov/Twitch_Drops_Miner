import React, { useState, useEffect } from 'react';
import type { Account } from '../core/types';

interface AddAccountForm {
  username: string;
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [newAccount, setNewAccount] = useState<AddAccountForm>({
    username: '',
    access_token: '',
    refresh_token: '',
    user_id: ''
  });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        setAuthStatus(data);
      }
    } catch (err) {
      console.warn('Failed to fetch auth status');
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchAuthStatus();

    // Check if we have an OAuth code in the URL (from callback)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleOAuthCallback(code);
      // Clear the code from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setOauthLoading(true);
    try {
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!response.ok) throw new Error('OAuth authentication failed');
      const data = await response.json();
      await fetchAccounts();
      alert(data.account.isNew 
        ? `Successfully added account: ${data.account.username}`
        : `Successfully logged in: ${data.account.username}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'OAuth authentication failed');
    } finally {
      setOauthLoading(false);
    }
  };
  const handleManualCodeSubmit = async (code: string) => {
    if (!code.trim()) {
      alert('Please enter the authorization code');
      return;
    }
    setOauthLoading(true);
    try {
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      if (!response.ok) throw new Error('OAuth authentication failed');
      const data = await response.json();
      await fetchAccounts();
      setShowManualCodeModal(false);
      setManualAuthCode('');
      alert(data.account.isNew
        ? `Successfully added account: ${data.account.username}`
        : `Successfully logged in: ${data.account.username}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'OAuth authentication failed');
    } finally {
      setOauthLoading(false);
    }
  };


  const handleLoginWithTwitch = async () => {
    setOauthLoading(true);
    try {
      const response = await fetch('/api/auth/twitch');
      if (!response.ok) throw new Error('Failed to generate authorization URL');
      const data = await response.json();
      
      // Store state before redirecting
      sessionStorage.setItem('oauth_state', 'pending');
      
      // Redirect to Twitch authorization page
      window.open(data.authUrl, 'twitch_oauth', 'width=600,height=700,popup');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start OAuth flow');
      setOauthLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount)
      });
      if (!response.ok) throw new Error('Failed to add account');
      await fetchAccounts();
      setShowAddModal(false);
      setNewAccount({ username: '', access_token: '', refresh_token: '', user_id: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add account');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete account');
      await fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Accounts</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Accounts</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Add Account Manually
          </button>
          <button
            onClick={handleLoginWithTwitch}
            disabled={oauthLoading || !authStatus?.configured}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {oauthLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
                Login with Twitch
              </>
            )}
          </button>
        </div>
      </div>

      {!authStatus?.configured && (
        <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
          <p className="text-yellow-400 font-medium">
            ⚠️ OAuth not configured
          </p>
          <p className="text-yellow-300/80 text-sm mt-1">
            Please configure TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, and TWITCH_REDIRECT_URI environment variables to enable OAuth login.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">No accounts configured</p>
            <div className="flex justify-center gap-3 mt-4">
              {authStatus?.configured && (
                <button
                  onClick={handleLoginWithTwitch}
                  disabled={oauthLoading}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Login with Twitch
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Add Account Manually
              </button>
            </div>
          </div>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{account.username || 'Unknown'}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      account.status === 'active' ? 'bg-green-900/50 text-green-400' :
                      account.status === 'inactive' ? 'bg-gray-900/50 text-gray-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {account.status || 'unknown'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>User ID: {account.user_id}</p>
                    {account.last_active && (
                      <p>Last Active: {new Date(account.last_active).toLocaleString()}</p>
                    )}
                    {account.points_balance !== undefined && (
                      <p>Points: {account.points_balance.toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded border border-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      

      {/* Manual OAuth Code Entry Modal */}
      {showManualCodeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Add Account via OAuth Code</h3>
            <div className="space-y-4">
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm font-medium mb-2">Step 1: Click the button below to open Twitch authorization</p>
                <button
                  onClick={handleLoginWithTwitch}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >
                  Open Twitch Authorization Page
                </button>
              </div>
              
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm font-medium mb-2">Step 2: After authorizing, copy the code from the URL</p>
                <p className="text-xs text-gray-400 mb-2">The code is the 'code=' parameter in the redirected URL</p>
                
                <label className="block text-sm font-medium mb-1">Paste Authorization Code</label>
                <input
                  type="text"
                  required
                  placeholder="Paste the code from Twitch authorization URL"
                  value={manualAuthCode}
                  onChange={e => setManualAuthCode(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded focus:outline-none focus:border-purple-500 font-mono text-sm"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualCodeModal(false);
                    setManualAuthCode('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleManualCodeSubmit(manualAuthCode)}
                  disabled={!manualAuthCode.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                >
                  Submit Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Add Account Manually</h3>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newAccount.username}
                  onChange={e => setNewAccount({...newAccount, username: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <input
                  type="text"
                  required
                  value={newAccount.user_id}
                  onChange={e => setNewAccount({...newAccount, user_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Access Token</label>
                <input
                  type="password"
                  required
                  value={newAccount.access_token}
                  onChange={e => setNewAccount({...newAccount, access_token: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Refresh Token</label>
                <input
                  type="password"
                  required
                  value={newAccount.refresh_token}
                  onChange={e => setNewAccount({...newAccount, refresh_token: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
