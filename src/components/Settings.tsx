import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, RotateCcw, Bell, Palette, Server, Shield, Settings as SettingsIcon } from 'lucide-react';

interface Settings {
  [key: string]: string;
}

interface SettingCategory {
  title: string;
  icon: React.ReactNode;
  description: string;
  keys: string[];
}

interface NotificationPrefs {
  enabled: boolean;
  sound: boolean;
  drops: boolean;
  points: boolean;
  errors: boolean;
  autoDismiss: boolean;
}

interface ThemeConfig {
  mode: 'dark' | 'light' | 'auto';
  accentColor: string;
  highContrast: boolean;
}

const settingsCategories: SettingCategory[] = [
  {
    title: 'Service Configuration',
    icon: <Server size={20} />,
    description: 'Configure the intervals and behavior of background services',
    keys: ['DROP_CHECK_INTERVAL', 'POINT_CLAIM_INTERVAL', 'CHAT_FARMING_INTERVAL', 'STREAM_CHECK_INTERVAL']
  },
  {
    title: 'Twitch API',
    icon: <Shield size={20} />,
    description: 'Twitch API credentials and endpoints',
    keys: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_API_URL']
  },
  {
    title: 'Automation',
    icon: <SettingsIcon size={20} />,
    description: 'Playwright and automation settings',
    keys: ['HEADLESS_BROWSER', 'BROWSER_TIMEOUT', 'MAX_CONCURRENT_BROWSER']
  },
  {
    title: 'Logging',
    icon: <SettingsIcon size={20} />,
    description: 'Application logging configuration',
    keys: ['LOG_LEVEL', 'LOG_TO_FILE', 'LOG_TO_CONSOLE']
  },
  {
    title: 'Server',
    icon: <Server size={20} />,
    description: 'Server configuration',
    keys: ['PORT', 'HOST', 'NODE_ENV']
  }
];

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Notification preferences (stored in localStorage)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    enabled: true,
    sound: true,
    drops: true,
    points: true,
    errors: true,
    autoDismiss: true
  });

  // Theme configuration (stored in localStorage)
  const [theme, setTheme] = useState<ThemeConfig>({
    mode: 'dark',
    accentColor: '#9146FF',
    highContrast: false
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    
    // Load notification preferences from localStorage
    const savedNotifPrefs = localStorage.getItem('notificationPrefs');
    if (savedNotifPrefs) {
      setNotificationPrefs(JSON.parse(savedNotifPrefs));
    }

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(JSON.parse(savedTheme));
    }
  }, []);

  const validateSetting = (key: string, value: string): string | null => {
    if (key.includes('INTERVAL') || key.includes('TIMEOUT') || key === 'PORT') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0) {
        return 'Must be a positive number';
      }
      if (key.includes('INTERVAL') && num < 10) {
        return 'Minimum interval is 10 seconds';
      }
      if (key === 'PORT' && (num < 1024 || num > 65535)) {
        return 'Port must be between 1024 and 65535';
      }
    }
    if (key.includes('CLIENT_SECRET') && value.length < 10) {
      return 'Client secret must be at least 10 characters';
    }
    return null;
  };

  const handleSettingChange = (key: string, value: string) => {
    const validationError = validateSetting(key, value);
    setValidationErrors(prev => ({
      ...prev,
      [key]: validationError || ''
    }));
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (category: SettingCategory) => {
    try {
      setSaving(true);
      const settingsToUpdate = category.keys.reduce((acc, key) => {
        if (settings[key] !== undefined && !validationErrors[key]) {
          acc[key] = settings[key];
        }
        return acc;
      }, {} as Settings);

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToUpdate)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to default values?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });

      if (!response.ok) throw new Error('Failed to reset settings');

      await fetchSettings();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key: keyof NotificationPrefs, value: boolean) => {
    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);
    localStorage.setItem('notificationPrefs', JSON.stringify(newPrefs));
  };

  const handleThemeChange = (key: keyof ThemeConfig, value: string | boolean) => {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
    localStorage.setItem('theme', JSON.stringify(newTheme));
  };

  const renderSettingInput = (key: string) => {
    const value = settings[key] || '';
    const error = validationErrors[key];
    const isNumber = key.includes('INTERVAL') || key.includes('TIMEOUT') || key === 'PORT' || key === 'MAX_CONCURRENT_BROWSER';
    const isBoolean = key.startsWith('LOG_TO_') || key === 'HEADLESS_BROWSER';
    const isSecret = key.includes('SECRET') || key.includes('TOKEN');

    if (isBoolean) {
      return (
        <select
          value={value.toLowerCase()}
          onChange={e => handleSettingChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] focus:outline-none focus:border-[#9146FF] transition-colors"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (isNumber) {
      return (
        <input
          type="number"
          value={value}
          onChange={e => handleSettingChange(key, e.target.value)}
          className={`w-full px-3 py-2 bg-[#09090b] border rounded-lg text-[#fafafa] focus:outline-none transition-colors ${
            error ? 'border-[#ef4444]' : 'border-[#27272a] focus:border-[#9146FF]'
          }`}
        />
      );
    }

    return (
      <input
        type={isSecret ? 'password' : 'text'}
        value={value}
        onChange={e => handleSettingChange(key, e.target.value)}
        placeholder={isSecret ? '••••••••' : ''}
        className={`w-full px-3 py-2 bg-[#09090b] border rounded-lg text-[#fafafa] focus:outline-none transition-colors ${
          error ? 'border-[#ef4444]' : 'border-[#27272a] focus:border-[#9146FF]'
        }`}
      />
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Settings</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[#18181b] rounded-lg"></div>
          <div className="h-32 bg-[#18181b] rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Configure your application preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] disabled:bg-[#18181b] disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset All
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 bg-[#9146FF] hover:bg-[#7c3aed] disabled:bg-[#27272a] disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-4"
          >
            <p className="text-[#10b981] flex items-center gap-2">
              <Save size={18} />
              Settings saved successfully!
            </p>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-4"
          >
            <p className="text-[#ef4444]">Error: {error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Preferences */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#9146FF]/10 rounded-lg text-[#9146FF]">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <p className="text-sm text-[#a1a1aa]">Customize how and when you receive notifications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleSetting
            label="Enable Notifications"
            checked={notificationPrefs.enabled}
            onChange={(v) => handleNotificationChange('enabled', v)}
            description="Turn all notifications on or off"
          />
          <ToggleSetting
            label="Sound Notifications"
            checked={notificationPrefs.sound}
            onChange={(v) => handleNotificationChange('sound', v)}
            description="Play sound for important events"
          />
          <ToggleSetting
            label="Drop Notifications"
            checked={notificationPrefs.drops}
            onChange={(v) => handleNotificationChange('drops', v)}
            description="Notify when drops are claimed"
          />
          <ToggleSetting
            label="Points Notifications"
            checked={notificationPrefs.points}
            onChange={(v) => handleNotificationChange('points', v)}
            description="Notify when points are claimed"
          />
          <ToggleSetting
            label="Error Notifications"
            checked={notificationPrefs.errors}
            onChange={(v) => handleNotificationChange('errors', v)}
            description="Notify about errors and warnings"
          />
          <ToggleSetting
            label="Auto-dismiss"
            checked={notificationPrefs.autoDismiss}
            onChange={(v) => handleNotificationChange('autoDismiss', v)}
            description="Automatically dismiss notifications after 5 seconds"
          />
        </div>
      </div>

      {/* Theme Configuration */}
      <div className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#ec4899]/10 rounded-lg text-[#ec4899]">
            <Palette size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Appearance</h3>
            <p className="text-sm text-[#a1a1aa]">Customize the look and feel</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#fafafa] mb-2">Theme Mode</label>
            <select
              value={theme.mode}
              onChange={(e) => handleThemeChange('mode', e.target.value)}
              className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] focus:outline-none focus:border-[#9146FF]"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#fafafa] mb-2">Accent Color</label>
            <div className="flex gap-2">
              {['#9146FF', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                <button
                  key={color}
                  onClick={() => handleThemeChange('accentColor', color)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    theme.accentColor === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b] scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color} accent`}
                />
              ))}
            </div>
          </div>

          <ToggleSetting
            label="High Contrast Mode"
            checked={theme.highContrast}
            onChange={(v) => handleThemeChange('highContrast', v)}
            description="Increase contrast for better visibility"
          />
        </div>
      </div>

      {/* System Settings Categories */}
      {settingsCategories.map(category => (
        <div key={category.title} className="bg-[#18181b] rounded-lg p-6 border border-[#27272a]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#27272a] rounded-lg text-[#a1a1aa]">
                {category.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{category.title}</h3>
                <p className="text-sm text-[#a1a1aa]">{category.description}</p>
              </div>
            </div>
            <button
              onClick={() => handleSave(category)}
              disabled={saving}
              className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] disabled:bg-[#18181b] disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Category
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {category.keys.map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-[#fafafa] mb-1">
                  {key}
                </label>
                {renderSettingInput(key)}
                {validationErrors[key] && (
                  <p className="text-xs text-[#ef4444] mt-1">{validationErrors[key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Warning Banner */}
      <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg p-4">
        <h4 className="font-semibold text-[#f59e0b] mb-2 flex items-center gap-2">
          <Bell size={18} />
          Restart Required
        </h4>
        <p className="text-sm text-[#a1a1aa]">
          Some settings changes may require a server restart to take effect.
          Make sure to restart the application after changing critical settings like service intervals or API credentials.
        </p>
      </div>
    </div>
  );
};

interface ToggleSettingProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ label, checked, onChange, description }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-[#09090b] rounded-lg border border-[#27272a]">
      <div>
        <p className="font-medium text-[#fafafa]">{label}</p>
        {description && <p className="text-xs text-[#a1a1aa] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#9146FF]' : 'bg-[#27272a]'
        }`}
        aria-label={`Toggle ${label}`}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 bg-white rounded-full"
          animate={{ left: checked ? 28 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
};

export default Settings;
