import React, { useState, useEffect } from 'react';
import type { DropCampaign } from '../core/types';

export const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<DropCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'claimed' | 'expired'>('all');

  // Helper functions for game type handling
  const getGameName = (game: any) => typeof game === 'string' ? game : game?.name;
  const getGameGenres = (game: any) => typeof game === 'object' && game?.genres ? game.genres : null;

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const calculateProgress = (campaign: DropCampaign) => {
    if (!campaign.required_minutes_watch_time) return null;
    const current = campaign.current_minutes || 0;
    const required = campaign.required_minutes_watch_time;
    const percentage = Math.min(100, (current / required) * 100);
    return { current, required, percentage };
  };

  const getRemainingTime = (campaign: DropCampaign) => {
    if (!campaign.ends_at) return null;
    const end = new Date(campaign.ends_at);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Drop Campaigns</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Drop Campaigns</h2>
        <div className="flex gap-2">
          {(['all', 'active', 'claimed', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {filteredCampaigns.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <p className="text-gray-400">
              {filter === 'all' ? 'No campaigns found' : `No ${filter} campaigns`}
            </p>
          </div>
        ) : (
          filteredCampaigns.map(campaign => {
            const progress = calculateProgress(campaign);
            const remaining = getRemainingTime(campaign);
            
            return (
              <div key={campaign.id} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs capitalize ${
                        campaign.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        campaign.status === 'claimed' ? 'bg-blue-900/50 text-blue-400' :
                        campaign.status === 'expired' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-900/50 text-gray-400'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {getGameName(campaign.game) || 'Unknown Game'}
                      {getGameGenres(campaign.game) && (
                        <span className="ml-2 text-gray-500">
                          ({getGameGenres(campaign.game).join(', ')})
                        </span>
                      )}
                    </p>
                  </div>
                  {remaining && (
                    <div className={`text-right ${
                      remaining === 'Expired' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      <p className="text-xs font-medium uppercase">Time Remaining</p>
                      <p className="text-lg font-bold">{remaining}</p>
                    </div>
                  )}
                </div>

                {progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Watch Time Progress</span>
                      <span className="text-gray-300">
                        {Math.floor(progress.current)} / {progress.required} minutes
                        ({progress.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {campaign.allowed_channels && campaign.allowed_channels.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-400 mb-2">Eligible Channels:</p>
                    <div className="flex flex-wrap gap-2">
                      {campaign.allowed_channels.slice(0, 5).map(channel => (
                        <span 
                          key={typeof channel === "string" ? channel : (channel as any).id}
                          className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                        >
                          {typeof channel === "string" ? channel : (channel as any).name}
                        </span>
                      ))}
                      {campaign.allowed_channels.length > 5 && (
                        <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400">
                          +{campaign.allowed_channels.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Campaigns;
