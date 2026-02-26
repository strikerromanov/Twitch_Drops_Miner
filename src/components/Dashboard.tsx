import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketProvider';
import type { DropCampaign, Account } from '../core/types';

interface SystemStats {
  activeAccounts: number;
  totalAccounts: number;
  totalDrops: number;
  activeDrops: number;
  claimedDrops: number;
  activeStreams: number;
  recentClaims: number;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<DropCampaign[]>([]);
  const { connected } = useWebSocket();

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setActiveCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
    const interval = setInterval(() => {
      fetchStats();
      fetchCampaigns();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          connected ? 'bg-green-900/30 text-green-400 border border-green-500' : 'bg-red-900/30 text-red-400 border border-red-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* System Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Accounts</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-green-400">{stats.activeAccounts}</span>
              <span className="text-gray-500 text-sm mb-1">/ {stats.totalAccounts} active</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Active Drops</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-purple-400">{stats.activeDrops}</span>
              <span className="text-gray-500 text-sm mb-1">/ {stats.totalDrops} total</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Claimed Drops</h3>
            <span className="text-3xl font-bold text-blue-400">{stats.claimedDrops}</span>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Recent Claims (1h)</h3>
            <span className="text-3xl font-bold text-yellow-400">{stats.recentClaims}</span>
          </div>
        </div>
      )}

      {/* Active Campaigns */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Active Drop Campaigns</h3>
        {activeCampaigns.length === 0 ? (
          <p className="text-gray-400">No active campaigns</p>
        ) : (
          <div className="space-y-3">
            {activeCampaigns.map(campaign => (
              <div key={campaign.id} className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{campaign.name}</h4>
                    <p className="text-sm text-gray-400">{getGameName(campaign.game) || 'Unknown Game'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    campaign.status === 'active' ? 'bg-green-900/50 text-green-400' :
                    campaign.status === 'claimed' ? 'bg-blue-900/50 text-blue-400' :
                    'bg-gray-900/50 text-gray-400'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.required_minutes_watch_time && (
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (campaign.current_minutes || 0) / campaign.required_minutes_watch_time * 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
