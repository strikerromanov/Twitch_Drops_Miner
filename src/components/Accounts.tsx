import { useEffect, useState } from 'react';
import { Plus, Play, Square, RefreshCw, Trash2, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '../App';

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { showToast } = useToast();

  const fetchAccounts = () => {
    fetch('/api/accounts').then(r => r.json()).then(setAccounts);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddClick = () => {
    // Generate a mock device code for the UI
    setAuthCode(Math.random().toString(36).substring(2, 10).toUpperCase());
    setIsModalOpen(true);
  };

  const handleAuthorize = async () => {
    setIsAuthenticating(true);
    try {
      await fetch('/api/accounts/auth', { method: 'POST' });
      showToast('Account successfully linked and authenticated!');
      setIsModalOpen(false);
      fetchAccounts();
    } catch (error) {
      showToast('Authentication failed.', 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to remove this account?')) {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      showToast('Account removed.');
      fetchAccounts();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-[#a1a1aa] mt-1">Manage your connected Twitch accounts via Device Auth.</p>
        </div>
        <button 
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-[#9146FF] hover:bg-[#772ce8] text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Account
        </button>
      </header>

      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] bg-[#18181b]/50">
          <div className="col-span-3 col-header">Username</div>
          <div className="col-span-2 col-header">Status</div>
          <div className="col-span-3 col-header">Current Target</div>
          <div className="col-span-2 col-header text-right">Points</div>
          <div className="col-span-2 col-header text-right">Actions</div>
        </div>
        
        <div className="divide-y divide-[#27272a]">
          {accounts.length === 0 && (
            <div className="p-8 text-center text-[#a1a1aa]">
              No accounts connected. Click "Add Account" to link your first Twitch account.
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#27272a]/30 transition-colors">
              <div className="col-span-3 font-medium flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9146FF] to-purple-400 flex items-center justify-center text-xs font-bold text-white">
                  {acc.username.substring(0,2).toUpperCase()}
                </div>
                {acc.username}
              </div>
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  acc.status === 'farming' 
                    ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' 
                    : 'bg-[#a1a1aa]/10 text-[#a1a1aa] border-[#a1a1aa]/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${acc.status === 'farming' ? 'bg-[#10b981]' : 'bg-[#a1a1aa]'}`}></span>
                  {acc.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-3 text-[#a1a1aa] flex items-center gap-2">
                {acc.currentTarget ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    twitch.tv/{acc.currentTarget}
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="col-span-2 text-right data-value text-[#fafafa]">
                {acc.points.toLocaleString()}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button className="p-1.5 text-[#a1a1aa] hover:text-[#10b981] hover:bg-[#27272a] rounded transition-colors" title="Start/Stop">
                  {acc.status === 'farming' ? <Square size={16} /> : <Play size={16} />}
                </button>
                <button className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded transition-colors" title="Force Refresh">
                  <RefreshCw size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(acc.id)}
                  className="p-1.5 text-[#a1a1aa] hover:text-red-400 hover:bg-[#27272a] rounded transition-colors" 
                  title="Remove Account"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Device Auth Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-semibold mb-2">Link Twitch Account</h2>
            <p className="text-[#a1a1aa] text-sm mb-6">
              Follow these steps to securely link your account without providing your password.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm">Go to the Twitch activation page:</p>
                  <a 
                    href="https://www.twitch.tv/activate" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[#9146FF] hover:underline flex items-center gap-1 mt-1 text-sm font-medium"
                  >
                    twitch.tv/activate <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm">Enter the following device code:</p>
                  <div className="mt-2 bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-center">
                    <span className="font-mono text-2xl tracking-widest text-[#fafafa]">{authCode.slice(0,4)}-{authCode.slice(4)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg font-medium text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAuthorize}
                disabled={isAuthenticating}
                className="flex items-center gap-2 bg-[#9146FF] hover:bg-[#772ce8] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isAuthenticating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                I've Authorized
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
