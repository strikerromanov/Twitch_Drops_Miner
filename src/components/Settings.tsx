import { useEffect, useState } from 'react';
import { Save, MonitorPlay, Key, TrendingUp, Activity, Gift, Settings as SettingsIcon } from 'lucide-react';
import { useToast } from '../App';

export default function Settings() {
  const [concurrentStreams, setConcurrentStreams] = useState(10);
  const [autoDetect, setAutoDetect] = useState(true);
  const [twitchClientId, setTwitchClientId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  
  // New betting settings
  const [bettingEnabled, setBettingEnabled] = useState(false);
  const [maxBetPercentage, setMaxBetPercentage] = useState(5);
  const [pointClaimInterval, setPointClaimInterval] = useState(300);
  const [dropAllocation, setDropAllocation] = useState(20);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.twitchClientId) setTwitchClientId(data.twitchClientId);
        if (data.concurrentStreams) setConcurrentStreams(parseInt(data.concurrentStreams));
        if (data.bettingEnabled) setBettingEnabled(data.bettingEnabled === 'true');
        if (data.maxBetPercentage) setMaxBetPercentage(parseInt(data.maxBetPercentage));
        if (data.pointClaimInterval) setPointClaimInterval(parseInt(data.pointClaimInterval));
        if (data.dropAllocation) setDropAllocation(parseInt(data.dropAllocation));
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          twitchClientId,
          concurrentStreams: autoDetect ? 10 : concurrentStreams,
          dropAllocation
        })
      });
      
      // Save betting settings separately
      await fetch('/api/settings/betting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bettingEnabled, maxBetPercentage })
      });
      
      showToast('Settings successfully saved.');
    } catch (error) {
      showToast('Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (confirm('WARNING: This will delete all accounts, bet history, and settings from the local SQLite database. Are you absolutely sure?')) {
      try {
        await fetch('/api/factory-reset', { method: 'POST' });
        showToast('Database reset successfully. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        showToast('Failed to reset database.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-[#a1a1aa] mt-1">System configuration and preferences.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#fafafa] hover:bg-[#e4e4e7] disabled:opacity-50 text-[#09090b] px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
        
        {/* Twitch API Configuration */}
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key size={18} className="text-[#9146FF]" />
            Twitch API Configuration
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-4">
            Required for adding accounts via Device Authentication. Your Client ID is stored locally in the SQLite database.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Twitch Client ID</label>
              <input
                type="text"
                value={twitchClientId}
                onChange={(e) => setTwitchClientId(e.target.value)}
                placeholder="Enter your Client ID"
                className="col-span-2 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#9146FF] text-[#fafafa] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Betting Configuration */}
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-500" />
            Betting Configuration
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-4">
            Configure automated betting strategies and risk management.
          </p>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Enable Automated Betting</label>
              <div className="col-span-2 flex items-center">
                <input 
                  type="checkbox" 
                  checked={bettingEnabled}
                  onChange={(e) => setBettingEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-[#27272a] text-purple-500 focus:ring-purple-500 bg-[#09090b]" 
                />
                <span className="ml-2 text-sm text-[#fafafa]">Place bets automatically using Kelly Criterion strategy</span>
              </div>
            </div>
            
            <div className={`grid grid-cols-3 gap-4 items-center transition-opacity ${!bettingEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div>
                <label className="text-sm font-medium text-[#a1a1aa]">Max Bet Percentage</label>
                <p className="text-xs text-[#a1a1aa] mt-1">Maximum % of total points to bet per wager</p>
              </div>
              <div className="col-span-2 flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={maxBetPercentage}
                  onChange={(e) => setMaxBetPercentage(parseInt(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <span className="text-sm font-mono text-[#fafafa] w-16 text-right">{maxBetPercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Point Farming Configuration */}
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-green-500" />
            Point Farming Configuration
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-4">
            Configure automatic point claiming from channels.
          </p>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-sm font-medium text-[#a1a1aa]">Claim Interval</label>
                <p className="text-xs text-[#a1a1aa] mt-1">How often to attempt point claims (minutes)</p>
              </div>
              <div className="col-span-2 flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={pointClaimInterval / 60}
                  onChange={(e) => setPointClaimInterval(parseInt(e.target.value) * 60)}
                  className="flex-1 accent-green-500"
                />
                <span className="text-sm font-mono text-[#fafafa] w-16 text-right">{pointClaimInterval / 60} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drop Allocation Configuration */}
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gift size={18} className="text-[#9146FF]" />
            Drop Allocation Strategy
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-4">
            Configure the 20/80 split between drop campaigns and favorite channels.
          </p>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-sm font-medium text-[#a1a1aa]">Drop Campaign Allocation</label>
                <p className="text-xs text-[#a1a1aa] mt-1">Percentage of streams for farming drops</p>
              </div>
              <div className="col-span-2 flex items-center gap-4">
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={dropAllocation}
                  onChange={(e) => setDropAllocation(parseInt(e.target.value))}
                  className="flex-1 accent-[#9146FF]"
                />
                <span className="text-sm font-mono text-[#fafafa] w-16 text-right">{dropAllocation}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-[#27272a]/30 rounded-lg p-3">
                <p className="font-medium text-[#9146FF]">{dropAllocation}% Drops</p>
                <p className="text-xs text-[#a1a1aa] mt-1">Streams watching drop campaigns</p>
              </div>
              <div className="bg-[#27272a]/30 rounded-lg p-3">
                <p className="font-medium text-green-500">{100 - dropAllocation}% Favorites</p>
                <p className="text-xs text-[#a1a1aa] mt-1">Streams watching followed channels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Concurrency & Resources */}
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MonitorPlay size={18} className="text-blue-500" />
            Concurrency & Resources
          </h2>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 items-start">
              <div>
                <label className="text-sm font-medium text-[#a1a1aa]">Max Concurrent Streams</label>
                <p className="text-xs text-[#a1a1aa] mt-1">Number of streams to watch simultaneously per account.</p>
              </div>
              <div className="col-span-2 space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoDetect}
                    onChange={(e) => setAutoDetect(e.target.checked)}
                    className="w-4 h-4 rounded border-[#27272a] text-blue-500 focus:ring-blue-500 bg-[#09090b]"
                  />
                  <span className="ml-2 text-sm text-[#fafafa]">Auto-detect based on system resources</span>
                </div>
                
                <div className={`flex items-center gap-4 transition-opacity ${autoDetect ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <MonitorPlay size={18} className="text-[#a1a1aa]" />
                  <input
                    type="range"
                    className="flex-1 accent-blue-500"
                    min="1"
                    max="10"
                    value={concurrentStreams}
                    onChange={(e) => setConcurrentStreams(parseInt(e.target.value))}
                  />
                  <span className="text-sm font-mono text-[#fafafa] w-8 text-right">{concurrentStreams}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6 bg-red-500/5">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-500">
            <SettingsIcon size={18} />
            Danger Zone
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-400">Factory Reset</p>
                <p className="text-sm text-[#a1a1aa]">Delete all data including accounts, bet history, and settings.</p>
              </div>
              <button
                onClick={handleFactoryReset}
                className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors"
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
