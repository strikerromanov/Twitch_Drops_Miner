import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Bell, Volume2, VolumeX } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  duration?: number;
  sound?: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  addNotification: (message: string, type: Notification['type'], duration?: number, sound?: boolean) => void;
  removeNotification: (id: string) => void;
  clearHistory: () => void;
  history: Notification[];
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const NotificationsContext = React.createContext<NotificationsContextType | null>(null);

export const useNotifications = () => {
  const context = React.useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
};

// Audio contexts for notification sounds
const playNotificationSound = (type: Notification['type']) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different frequencies for different notification types
    const frequencies = {
      success: 880, // A5
      error: 220,   // A3
      warning: 440, // A4
      info: 660     // E5
    };
    
    oscillator.frequency.value = frequencies[type];
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const addNotification = useCallback((
    message: string,
    type: Notification['type'] = 'info',
    duration: number = 5000,
    sound: boolean = type === 'success' // Only play sound for successes by default
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const notification: Notification = {
      id,
      type,
      message,
      timestamp: new Date(),
      duration,
      sound
    };

    setNotifications(prev => [...prev, notification]);
    setHistory(prev => [notification, ...prev].slice(0, 100)); // Keep last 100

    if (sound && soundEnabled) {
      playNotificationSound(type);
    }

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }, [soundEnabled]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearHistory,
      history,
      soundEnabled,
      toggleSound
    }}>
      {children}
      <NotificationToastContainer />
    </NotificationsContext.Provider>
  );
};

const NotificationToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const getNotificationStyles = (type: Notification['type']) => {
    const styles = {
      success: 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]',
      error: 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]',
      warning: 'bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]',
      info: 'bg-[#3b82f6]/10 border-[#3b82f6]/20 text-[#3b82f6]'
    };
    return styles[type];
  };

  const getIcon = (type: Notification['type']) => {
    const icons = {
      success: CheckCircle2,
      error: XCircle,
      warning: AlertTriangle,
      info: Info
    };
    return icons[type];
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = getIcon(notification.type);
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 50, scale: 0.9, x: 100 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, x: 100 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex items-start gap-3 p-4 rounded-lg shadow-xl border backdrop-blur-sm ${
                getNotificationStyles(notification.type)
              }`}
              role="alert"
              aria-live="polite"
            >
              <Icon size={20} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{notification.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {notification.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Notification History Panel Component
export const NotificationHistory: React.FC = () => {
  const { history, clearHistory, soundEnabled, toggleSound } = useNotifications();
  const [filter, setFilter] = useState<Notification['type'] | 'all'>('all');

  const filteredHistory = filter === 'all'
    ? history
    : history.filter(n => n.type === filter);

  const getIcon = (type: Notification['type']) => {
    const icons = {
      success: CheckCircle2,
      error: XCircle,
      warning: AlertTriangle,
      info: Info
    };
    const Icon = icons[type];
    return <Icon size={16} className={type} />;
  };

  const getTypeColor = (type: Notification['type']) => {
    const colors = {
      success: 'text-[#10b981]',
      error: 'text-[#ef4444]',
      warning: 'text-[#f59e0b]',
      info: 'text-[#3b82f6]'
    };
    return colors[type];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notification History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled
                ? 'bg-[#9146FF] text-white'
                : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
            aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={clearHistory}
            className="px-3 py-2 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg text-sm font-medium transition-colors"
          >
            Clear History
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'success', 'error', 'warning', 'info'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === type
                ? 'bg-[#9146FF] text-white'
                : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-[#a1a1aa]">
              <Bell size={48} className="mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            filteredHistory.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex items-start gap-3 p-3 rounded-lg bg-[#18181b] border border-[#27272a] ${
                  getTypeColor(notification.type)
                }`}
              >
                {getIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#fafafa]">{notification.message}</p>
                  <p className="text-xs text-[#a1a1aa] mt-0.5">
                    {notification.timestamp.toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
