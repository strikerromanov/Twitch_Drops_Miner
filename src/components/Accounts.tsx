import { useEffect, useState, useRef } from 'react';
import { Plus, Play, Square, RefreshCw, Trash2, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../App';

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deviceAuth, setDeviceAuth] = useState<{ userCode: string, deviceCode: string, verificationUri: string, interval: number } | null>(null);
  const [authError, setAuthError] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  const fetchAccounts = () => {
    fetch('/api/accounts').then(r => r.json()).then(setAccounts);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddClick = async () => {
    setIsModalOpen(true);
    setDeviceAuth(null);
    setAuthError('');
    setIsAuthenticating(true);

    try {
      const res = await fetch('/api/auth/device', { method: 'POST' });
      const data = await res.json();
      
      if (data.error) {
        setAuthError(data.error);
      } else {
        setDeviceAuth({
          userCode: data.user_code,
          deviceCode: data.device_code,
          verificationUri: data.verification_uri,
          interval: data.interval || 5
        });
      }
    } catch (err) {
      setAuthError('Network error while initiating authentication.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (deviceAuth && isModalOpen) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/auth/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceAuth.deviceCode })
          });
          const data = await res.json();
          
          if (data.status === 'success') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            showToast(`Successfully authenticated as ${data.username}`);
            setIsModalOpen(false);
            fetchAccounts();
          } else if (data.error) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setAuthError(data.error);
          }
          // If pending, do nothing and wait for next interval
        } catch (err) {
          // Ignore network errors during polling
        }
      }, deviceAuth.interval * 1000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [deviceAuth, isModalOpen]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
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
            
            {isAuthenticating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#9146FF] mb-4" />
                <p className="text-[#a1a1aa]">Contacting Twitch API...</p>
              </div>
            ) : authError ? (
              <div className="py-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertCircle className="text-red-400 shrink-0" size={20} />
                    <div>
                      <h3 className="text-red-400 font-medium mb-1">Authentication Error</h3>
                      <p className="text-sm text-red-400/80">
                        {authError === 'TWITCH_CLIENT_ID_MISSING' 
                          ? 'Twitch Client ID is not configured.' 
                          : authError}
                      </p>
                    </div>
                  </div>
                </div>
                
                {authError === 'TWITCH_CLIENT_ID_MISSING' && (
                  <div className="bg-[#27272a]/30 rounded-lg p-4 text-sm text-[#a1a1aa] space-y-2 mb-6">
                    <p className="font-medium text-[#fafafa]">How to fix this:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" className="text-[#9146FF] hover:underline">Twitch Developer Console</a></li>
                      <li>Register Your Application</li>
                      <li>Copy the <strong>Client ID</strong></li>
                      <li>Go to the <strong>Settings</strong> tab in this app and save your Client ID.</li>
                    </ol>
                  </div>
                )}
              </div>
            ) : deviceAuth ? (
              <>
                <p className="text-[#a1a1aa] text-sm mb-6">
                  Follow these steps to securely link your account. This window will automatically close when authentication is complete.
                </p>
                
                <div className="space-y-4 mb-8">
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-sm">Go to the Twitch activation page:</p>
                      <a 
                        href={deviceAuth.verificationUri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[#9146FF] hover:underline flex items-center gap-1 mt-1 text-sm font-medium"
                      >
                        {deviceAuth.verificationUri.replace('https://', '')} <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                    <div className="w-full">
                      <p className="text-sm">Enter the following device code:</p>
                      <div className="mt-2 bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-center">
                        <span className="font-mono text-3xl tracking-widest text-[#fafafa] font-bold">{deviceAuth.userCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                    <div className="w-full flex items-center gap-3 pt-1">
                      <Loader2 size={16} className="animate-spin text-[#9146FF]" />
                      <p className="text-sm text-[#a1a1aa]">Waiting for authorization...</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex justify-end gap-3">
              <button 
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg font-medium text-[#a1a1aa] hover:text-white hover:bg-[#27272a] transition-colors"
              >
                {authError ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
