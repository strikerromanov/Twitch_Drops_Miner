import React, { useState, createContext, useContext } from 'react';
import { WebSocketProvider } from "./components/WebSocketProvider";
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Users, Gift, Coins, Settings as SettingsIcon, Menu, CheckCircle2, AlertCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Accounts from './components/Accounts';
import Campaigns from './components/Campaigns';
import Betting from './components/Betting';
import Settings from './components/Settings';

// Global Toast Context for UI feedback
export const ToastContext = createContext<any>(null);
export const useToast = () => useContext(ToastContext);


class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[#09090b] text-[#fafafa]">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-[#a1a1aa] mb-4">An error occurred while loading this page.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-[#9146FF] hover:bg-[#772ce8] rounded-lg"
            >
              Try Again
            </button>
            <p className="text-xs text-[#a1a1aa] mt-4 font-mono">{this.state.error?.toString()}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'accounts', label: 'Accounts', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Gift },
    { id: 'betting', label: 'Betting', icon: Coins },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'accounts': return <Accounts />;
      case 'campaigns': return <Campaigns />;
      case 'betting': return <Betting />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <WebSocketProvider>
    <ToastContext.Provider value={{ showToast }}>
      <div className="flex h-screen overflow-hidden bg-[#09090b] text-[#fafafa]">
        {/* Sidebar */}
        <motion.aside
          initial={{ width: 240 }}
          animate={{ width: isSidebarOpen ? 240 : 64 }}
          className="flex flex-col border-r border-[#27272a] bg-[#18181b] z-20"
        >
          <div className="flex items-center justify-between p-4 border-b border-[#27272a] h-16">
            {isSidebarOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded bg-[#9146FF] flex items-center justify-center font-bold text-white">
                  TF
                </div>
                <span className="font-semibold tracking-tight whitespace-nowrap">Twitch Farm Pro</span>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>

          <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-[#27272a] text-white shadow-sm' 
                      : 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-white'
                  }`}
                  title={!isSidebarOpen ? tab.label : undefined}
                >
                  <Icon size={20} className={isActive ? 'text-[#9146FF]' : ''} />
                  {isSidebarOpen && <span className="font-medium text-sm">{tab.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#27272a]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></div>
              {isSidebarOpen && <span className="text-xs font-mono text-[#a1a1aa]">SYSTEM ONLINE</span>}
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          <div className="p-8 max-w-7xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ErrorBoundary>{renderContent()}</ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Global Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border z-50 ${
                toast.type === 'success' 
                  ? 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]' 
                  : 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
    </WebSocketProvider>
  );
}
