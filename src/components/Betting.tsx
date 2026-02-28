import React, { useState, useEffect } from 'react';
import { BettingStats, RecentBet } from '../core/types';

export default function Betting() {
  const [stats, setStats] = useState<BettingStats | null>(null);
  const [history, setHistory] = useState<RecentBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBettingData();
    const interval = setInterval(loadBettingData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadBettingData() {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/betting-stats'),
        fetch('/api/betting-history?limit=50')
      ]);
      
      setStats(await statsRes.json());
      setHistory(await historyRes.json());
      setLoading(false);
    } catch (error) {
      console.error('Failed to load betting data:', error);
    }
  }

  if (loading) return <div className="p-4">Loading betting stats...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">🎰 Betting Dashboard</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-900/30 p-3 rounded border border-purple-700">
          <div className="text-purple-300 text-sm">Total Bets</div>
          <div className="text-2xl font-bold">{stats?.totalBets || 0}</div>
        </div>
        <div className="bg-green-900/30 p-3 rounded border border-green-700">
          <div className="text-green-300 text-sm">Wins</div>
          <div className="text-2xl font-bold">{stats?.wins || 0}</div>
        </div>
        <div className="bg-blue-900/30 p-3 rounded border border-blue-700">
          <div className="text-blue-300 text-sm">Win Rate</div>
          <div className="text-2xl font-bold">{stats?.winRate.toFixed(1)}% || 0</div>
        </div>
        <div className={`p-3 rounded border ${
          (stats?.netProfit || 0) >= 0 
            ? 'bg-green-900/30 border-green-700' 
            : 'bg-red-900/30 border-red-700'
        }`}>
          <div className={`text-sm ${
            (stats?.netProfit || 0) >= 0 ? 'text-green-300' : 'text-red-300'
          }`}>Net Profit</div>
          <div className="text-2xl font-bold">
            {(stats?.netProfit || 0).toLocaleString()} pts
          </div>
        </div>
      </div>

      {/* Recent Bets Table */}
      <div className="bg-black/30 rounded border border-gray-700">
        <div className="p-3 border-b border-gray-700">
          <h3 className="font-bold">Recent Bets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/50">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Streamer</th>
                <th className="p-2 text-left">Prediction</th>
                <th className="p-2 text-left">Outcome</th>
                <th className="p-2 text-right">Wagered</th>
                <th className="p-2 text-right">Won</th>
                <th className="p-2 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map(bet => (
                <tr key={bet.id} className="border-t border-gray-700">
                  <td className="p-2 text-sm text-gray-400">
                    {new Date(bet.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2">{bet.streamer_name}</td>
                  <td className="p-2 text-sm">{bet.prediction_title}</td>
                  <td className="p-2 text-sm">{bet.outcome_selected}</td>
                  <td className="p-2 text-right">{bet.points_wagered}</td>
                  <td className="p-2 text-right">{bet.points_won || 0}</td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      bet.points_won > 0 
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {bet.points_won > 0 ? 'WIN' : 'LOSS'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Betting Status */}
      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
        <div className="flex items-center justify-between">
          <span>🎰 Auto-Betting Status</span>
          <span className="text-yellow-300">Active (Conservative Mode)</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Bets automatically on predictions with &gt;60% confidence. Max 10% of points per bet.
        </div>
      </div>
    </div>
  );
}
