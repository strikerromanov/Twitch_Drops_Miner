import { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, History, BrainCircuit, Database, Sparkles } from 'lucide-react';

export default function Betting() {
  const [analysis, setAnalysis] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/streamer-analysis').then(r => r.json()).then(setAnalysis);
  }, []);

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Betting Engine</h1>
        <p className="text-[#a1a1aa] mt-1">Configure automated channel point betting strategies and analyze streamer history.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database size={18} className="text-[#a1a1aa]" />
              Local DB Strategies
            </h2>
            <p className="text-sm text-[#a1a1aa] mb-4">
              These strategies utilize your local SQLite database to track historical Win/Loss ratios per streamer and bet accordingly.
            </p>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border border-[#9146FF]/50 bg-[#9146FF]/5 rounded-lg cursor-pointer transition-colors relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#9146FF]"></div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <BrainCircuit size={16} className="text-[#9146FF]" />
                    Kelly Criterion (Optimal)
                  </div>
                  <div className="text-sm text-[#a1a1aa] mt-1">Calculates optimal bet size based on historical W/L ratio stored in local DB.</div>
                </div>
                <input type="radio" name="strategy" className="w-4 h-4 text-[#9146FF] bg-[#27272a] border-[#27272a] focus:ring-[#9146FF]" defaultChecked />
              </label>

              <label className="flex items-center justify-between p-4 border border-[#27272a] rounded-lg cursor-pointer hover:bg-[#27272a]/30 transition-colors">
                <div>
                  <div className="font-medium">Martingale System</div>
                  <div className="text-sm text-[#a1a1aa] mt-1">Doubles the bet amount after every loss to recover previous losses.</div>
                </div>
                <input type="radio" name="strategy" className="w-4 h-4 text-[#9146FF] bg-[#27272a] border-[#27272a] focus:ring-[#9146FF]" />
              </label>

              <label className="flex items-center justify-between p-4 border border-[#27272a] rounded-lg cursor-pointer hover:bg-[#27272a]/30 transition-colors">
                <div>
                  <div className="font-medium">Fibonacci Sequence</div>
                  <div className="text-sm text-[#a1a1aa] mt-1">Increases bet following the Fibonacci sequence on a loss. Safer than Martingale.</div>
                </div>
                <input type="radio" name="strategy" className="w-4 h-4 text-[#9146FF] bg-[#27272a] border-[#27272a] focus:ring-[#9146FF]" />
              </label>

              <label className="flex items-center justify-between p-4 border border-[#27272a] rounded-lg cursor-pointer hover:bg-[#27272a]/30 transition-colors">
                <div>
                  <div className="font-medium">Follow the Crowd</div>
                  <div className="text-sm text-[#a1a1aa] mt-1">Bet on the option with the highest total points (No DB required).</div>
                </div>
                <input type="radio" name="strategy" className="w-4 h-4 text-[#9146FF] bg-[#27272a] border-[#27272a] focus:ring-[#9146FF]" />
              </label>
            </div>

            <div className="mt-8 pt-6 border-t border-[#27272a]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles size={16} className="text-[#f59e0b]" />
                    AI Prediction Module <span className="text-xs px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa] ml-2">Optional</span>
                  </h3>
                  <p className="text-sm text-[#a1a1aa] mt-1">Uses external LLMs to analyze chat sentiment for live predictions.</p>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-[#27272a] text-[#9146FF] focus:ring-[#9146FF] bg-[#09090b]" />
                  <span className="ml-2 text-sm text-[#fafafa]">Enable AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Streamer Analysis & History */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#27272a] bg-[#18181b]/50 flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2">
                <History size={18} className="text-[#a1a1aa]" />
                Local DB W/L Tracking
              </h2>
            </div>
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] bg-[#27272a]/20">
              <div className="col-span-3 col-header">Streamer</div>
              <div className="col-span-2 col-header text-right">Win Rate</div>
              <div className="col-span-2 col-header text-right">Total Bets</div>
              <div className="col-span-2 col-header">Risk Level</div>
              <div className="col-span-3 col-header">Recommended</div>
            </div>
            <div className="divide-y divide-[#27272a]">
              {analysis.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#27272a]/30 transition-colors">
                  <div className="col-span-3 font-medium text-[#fafafa]">{item.streamer}</div>
                  <div className={`col-span-2 text-right font-mono ${item.winRate > 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    {item.winRate}%
                  </div>
                  <div className="col-span-2 text-right text-[#a1a1aa] font-mono">{item.totalBets}</div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      item.riskLevel === 'Low' || item.riskLevel === 'Very Low' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' :
                      item.riskLevel === 'Medium' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' :
                      'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                    }`}>
                      {item.riskLevel}
                    </span>
                  </div>
                  <div className="col-span-3 text-sm text-[#a1a1aa]">{item.recommendedStrategy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#9146FF]/20 to-[#18181b] border border-[#9146FF]/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-[#9146FF]" />
              <h3 className="font-semibold">Betting Performance</h3>
            </div>
            <div className="text-3xl font-mono font-bold text-white mt-4">+45,200</div>
            <p className="text-sm text-[#a1a1aa] mt-1">Net points from betting (7d)</p>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-xs text-[#a1a1aa] uppercase tracking-wider mb-1">Win Rate</div>
                <div className="font-mono text-lg text-[#10b981]">68.4%</div>
              </div>
              <div>
                <div className="text-xs text-[#a1a1aa] uppercase tracking-wider mb-1">Total Bets</div>
                <div className="font-mono text-lg">142</div>
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Risk Management</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-[#a1a1aa]">Max Bet Amount</label>
                  <span className="text-sm font-mono text-[#fafafa]">5,000 pts</span>
                </div>
                <input type="range" className="w-full accent-[#9146FF]" min="100" max="10000" defaultValue="5000" />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-[#a1a1aa]">Reserve Balance</label>
                  <span className="text-sm font-mono text-[#fafafa]">10,000 pts</span>
                </div>
                <input type="range" className="w-full accent-[#9146FF]" min="0" max="50000" defaultValue="10000" />
                <p className="text-xs text-[#a1a1aa] mt-2">Never bet if balance falls below this amount.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-2 text-[#f59e0b] mb-4">
              <AlertTriangle size={18} />
              <h3 className="font-semibold">Disclaimer</h3>
            </div>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              Automated betting carries inherent risks. The algorithms do not guarantee wins. 
              Always set a reserve balance to protect your hard-earned channel points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
