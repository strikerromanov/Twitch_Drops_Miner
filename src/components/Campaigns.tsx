import { useEffect, useState } from 'react';
import { Gift, Star, Plus, Trash2, ExternalLink, Clock, CheckCircle2, RefreshCw, Gamepad2 } from 'lucide-react';
import { useToast } from '../App';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const { showToast } = useToast();

  const fetchData = () => {
    fetch('/api/campaigns').then(r => r.json()).then(setCampaigns);
    fetch('/api/games').then(r => r.json()).then(setGames);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleGame = async (id: number) => {
    await fetch(`/api/games/${id}/toggle`, { method: 'POST' });
    fetchData();
  };

  const handleIndexDrops = () => {
    setIsIndexing(true);
    showToast('Indexing drops from twitch.tv/drops/campaigns...');
    
    // Simulate scraping/indexing delay
    setTimeout(() => {
      setIsIndexing(false);
      showToast('Successfully indexed 4 active campaigns.', 'success');
      fetchData();
    }, 2500);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Campaigns & Games</h1>
        <p className="text-[#a1a1aa] mt-1">Manage Twitch Drops campaigns and select which games to farm.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Drops Campaigns Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Gift className="text-[#9146FF]" />
              Active Drops Campaigns
            </h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleIndexDrops}
                disabled={isIndexing}
                className="text-sm bg-[#27272a] hover:bg-[#3f3f46] text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={isIndexing ? "animate-spin" : ""} />
                {isIndexing ? 'Indexing...' : 'Index Drops'}
              </button>
              <a 
                href="https://www.twitch.tv/drops/campaigns" 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-[#a1a1aa] hover:text-[#9146FF] flex items-center gap-1 transition-colors"
              >
                View on Twitch <ExternalLink size={14} />
              </a>
            </div>
          </div>
          <p className="text-sm text-[#a1a1aa]">
            The engine allocates 20% of your concurrent stream capacity to farm these drops.
          </p>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#27272a]">
              {campaigns.map(camp => (
                <div key={camp.id} className="p-4 hover:bg-[#27272a]/30 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-[#fafafa]">{camp.name}</h3>
                      <p className="text-sm text-[#a1a1aa]">{camp.game} • twitch.tv/{camp.streamer}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
                      camp.status === 'active' 
                        ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' 
                        : 'bg-[#a1a1aa]/10 text-[#a1a1aa] border-[#a1a1aa]/20'
                    }`}>
                      {camp.status === 'active' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                      {camp.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#a1a1aa]">
                      <span>Progress</span>
                      <span>{camp.progress}%</span>
                    </div>
                    <div className="w-full bg-[#27272a] rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${camp.progress === 100 ? 'bg-[#10b981]' : 'bg-[#9146FF]'}`} 
                        style={{ width: `${camp.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Games Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Gamepad2 className="text-blue-400" />
              Games with Drops
            </h2>
          </div>
          <p className="text-sm text-[#a1a1aa]">
            Select which games you want to automatically farm when new drop campaigns are detected.
          </p>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col h-[500px]">
            <div className="flex-1 overflow-y-auto divide-y divide-[#27272a]">
              {games.length === 0 ? (
                <div className="p-8 text-center text-[#a1a1aa]">
                  No games indexed.
                </div>
              ) : (
                games.map(game => (
                  <div key={game.id} className="flex items-center justify-between p-4 hover:bg-[#27272a]/30 transition-colors cursor-pointer" onClick={() => handleToggleGame(game.id)}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={game.whitelisted === 1}
                        readOnly
                        className="w-4 h-4 rounded border-[#27272a] text-[#9146FF] focus:ring-[#9146FF] bg-[#09090b]" 
                      />
                      <div>
                        <span className="font-medium text-[#fafafa] block">{game.name}</span>
                        <span className="text-xs text-[#a1a1aa]">Last drop: {game.lastDrop}</span>
                      </div>
                    </div>
                    {game.activeCampaigns > 0 && (
                      <span className="bg-[#9146FF]/10 text-[#9146FF] border border-[#9146FF]/20 px-2 py-0.5 rounded text-xs font-medium">
                        {game.activeCampaigns} Active
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
