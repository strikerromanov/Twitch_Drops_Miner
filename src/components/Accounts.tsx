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

  useEffect(() => {
    fetchAccounts();
  }, []);

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
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
        >
          Add Account
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">No accounts configured</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Add Your First Account
            </button>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold mb-4">Add Account</h3>
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
