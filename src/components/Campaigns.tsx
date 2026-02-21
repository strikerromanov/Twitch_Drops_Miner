import { useEffect, useState } from 'react';
import { Search, Filter, Clock, Check, X, List } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'whitelist'>('active');

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(setCampaigns);
    fetch('/api/games').then(r => r.json()).then(setGames);
  }, []);

  const toggleWhitelist = (id: number) => {
    setGames(games.map(g => g.id === id ? { ...g, whitelisted: !g.whitelisted } : g));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-[#a1a1aa] mt-1">Manage active drops and game whitelists.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" size={16} />
            <input 
              type="text" 
              placeholder="Search games..." 
              className="bg-[#18181b] border border-[#27272a] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#9146FF] transition-colors w-64"
            />
          </div>
          <button className="p-2 border border-[#27272a] rounded-lg bg-[#18181b] text-[#a1a1aa] hover:text-white transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#27272a] pb-px">
        <button 
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'active' ? 'border-[#9146FF] text-white' : 'border-transparent text-[#a1a1aa] hover:text-white'
          }`}
        >
          Active Drops
        </button>
        <button 
          onClick={() => setActiveTab('whitelist')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'whitelist' ? 'border-[#9146FF] text-white' : 'border-transparent text-[#a1a1aa] hover:text-white'
          }`}
        >
          Game Whitelist & History
        </button>
      </div>

      {activeTab === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {campaigns.map(camp => (
            <div key={camp.id} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
              <div className="h-32 bg-gradient-to-br from-[#27272a] to-[#18181b] relative p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                    camp.status === 'active' ? 'bg-[#10b981] text-white' : 'bg-[#27272a] text-[#a1a1aa]'
                  }`}>
                    {camp.status}
                  </span>
                  {camp.status === 'active' && (
                    <span className="flex items-center gap-1 text-xs font-mono bg-black/50 px-2 py-1 rounded text-white backdrop-blur-sm">
                      <Clock size={12} /> {camp.timeRemaining} left
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-xl text-white drop-shadow-md">{camp.game}</h3>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-[#a1a1aa] text-sm mb-4">{camp.name}</p>
                
                <div className="mt-auto space-y-2">
                  <div className="flex justify-between text-xs font-mono text-[#a1a1aa]">
                    <span>Progress</span>
                    <span>{camp.progress}%</span>
                  </div>
                  <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${camp.progress === 100 ? 'bg-[#10b981]' : 'bg-[#9146FF]'}`}
                      style={{ width: `${camp.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden mt-4">
          <div className="p-4 border-b border-[#27272a] bg-[#18181b]/50 flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2">
              <List size={18} className="text-[#9146FF]" />
              Indexed Games
            </h2>
            <p className="text-xs text-[#a1a1aa]">Enable games to automatically farm them when drops become available.</p>
          </div>
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] bg-[#27272a]/20">
            <div className="col-span-4 col-header">Game Name</div>
            <div className="col-span-3 col-header">Last Drop Event</div>
            <div className="col-span-3 col-header">Active Campaigns</div>
            <div className="col-span-2 col-header text-right">Farm Status</div>
          </div>
          <div className="divide-y divide-[#27272a]">
            {games.map(game => (
              <div key={game.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#27272a]/30 transition-colors">
                <div className="col-span-4 font-medium text-[#fafafa]">{game.name}</div>
                <div className="col-span-3 text-sm text-[#a1a1aa]">{game.lastDrop}</div>
                <div className="col-span-3">
                  {game.activeCampaigns > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                      {game.activeCampaigns} Active
                    </span>
                  ) : (
                    <span className="text-sm text-[#a1a1aa]">—</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end">
                  <button 
                    onClick={() => toggleWhitelist(game.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      game.whitelisted ? 'bg-[#9146FF]' : 'bg-[#27272a]'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      game.whitelisted ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
