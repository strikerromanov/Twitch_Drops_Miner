import { useState } from 'react';
import { Save, MonitorPlay } from 'lucide-react';

export default function Settings() {
  const [concurrentStreams, setConcurrentStreams] = useState(4);
  const [autoDetect, setAutoDetect] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-[#a1a1aa] mt-1">System configuration and preferences.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#fafafa] hover:bg-[#e4e4e7] text-[#09090b] px-4 py-2 rounded-lg font-medium transition-colors">
          <Save size={18} />
          Save Changes
        </button>
      </header>

      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4">General Configuration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Log Level</label>
              <select className="col-span-2 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#9146FF]">
                <option>INFO</option>
                <option>DEBUG</option>
                <option>WARNING</option>
                <option>ERROR</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Headless Mode</label>
              <div className="col-span-2 flex items-center">
                <input type="checkbox" className="w-4 h-4 rounded border-[#27272a] text-[#9146FF] focus:ring-[#9146FF] bg-[#09090b]" defaultChecked />
                <span className="ml-2 text-sm text-[#fafafa]">Run browser in background</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4">Concurrency & Resources</h2>
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
                    className="w-4 h-4 rounded border-[#27272a] text-[#9146FF] focus:ring-[#9146FF] bg-[#09090b]" 
                  />
                  <span className="ml-2 text-sm text-[#fafafa]">Auto-detect based on system resources</span>
                </div>
                
                <div className={`flex items-center gap-4 transition-opacity ${autoDetect ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <MonitorPlay size={18} className="text-[#a1a1aa]" />
                  <input 
                    type="range" 
                    className="flex-1 accent-[#9146FF]" 
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

        <div className="p-6 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold mb-4">Farming Priorities</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Primary Goal</label>
              <select className="col-span-2 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#9146FF]">
                <option>Concurrent Drops + Points (Drops Priority)</option>
                <option>Drops Only (Single Client per Drop)</option>
                <option>Points Only</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="text-sm font-medium text-[#a1a1aa]">Stream Switching</label>
              <div className="col-span-2 flex items-center">
                <input type="checkbox" className="w-4 h-4 rounded border-[#27272a] text-[#9146FF] focus:ring-[#9146FF] bg-[#09090b]" defaultChecked />
                <span className="ml-2 text-sm text-[#fafafa]">Auto-switch when stream goes offline</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
          <div className="p-4 border border-red-900/50 bg-red-950/20 rounded-lg flex justify-between items-center">
            <div>
              <h3 className="font-medium text-red-400">Reset All Data</h3>
              <p className="text-sm text-[#a1a1aa] mt-1">Clear all accounts, logs, and settings. This cannot be undone.</p>
            </div>
            <button className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-medium transition-colors">
              Factory Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
