import React, { useState, useEffect } from 'react';

interface Settings {
  [key: string]: string;
}

interface SettingCategory {
  title: string;
  keys: string[];
  description: string;
}

const settingsCategories: SettingCategory[] = [
  {
    title: 'Service Configuration',
    description: 'Configure the intervals and behavior of background services',
    keys: ['DROP_CHECK_INTERVAL', 'POINT_CLAIM_INTERVAL', 'CHAT_FARMING_INTERVAL', 'STREAM_CHECK_INTERVAL']
  },
  {
    title: 'Twitch API',
    description: 'Twitch API credentials and endpoints',
    keys: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_API_URL']
  },
  {
    title: 'Automation',
    description: 'Playwright and automation settings',
    keys: ['HEADLESS_BROWSER', 'BROWSER_TIMEOUT', 'MAX_CONCURRENT_BROWSER']
  },
  {
    title: 'Logging',
    description: 'Application logging configuration',
    keys: ['LOG_LEVEL', 'LOG_TO_FILE', 'LOG_TO_CONSOLE']
  },
  {
    title: 'Server',
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
  }, []);

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (category: SettingCategory) => {
    try {
      setSaving(true);
      const settingsToUpdate = category.keys.reduce((acc, key) => {
        if (settings[key] !== undefined) {
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

  const renderSettingInput = (key: string) => {
    const value = settings[key] || '';
    const isNumber = key.includes('INTERVAL') || key.includes('TIMEOUT') || key === 'PORT' || key === 'MAX_CONCURRENT_BROWSER';
    const isBoolean = key.startsWith('LOG_TO_') || key === 'HEADLESS_BROWSER';

    if (isBoolean) {
      return (
        <select
          value={value.toLowerCase()}
          onChange={e => handleSettingChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
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
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={e => handleSettingChange(key, e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-purple-500"
      />
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Settings</h2>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      {success && (
        <div className="bg-green-900/30 border border-green-500 rounded-lg p-4">
          <p className="text-green-400">Settings saved successfully!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}

      {settingsCategories.map(category => (
        <div key={category.title} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold">{category.title}</h3>
              <p className="text-sm text-gray-400">{category.description}</p>
            </div>
            <button
              onClick={() => handleSave(category)}
              disabled={saving}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              Save Category
            </button>
          </div>

          <div className="space-y-3">
            {category.keys.map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {key}
                </label>
                {renderSettingInput(key)}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Restart Required</h4>
        <p className="text-sm text-gray-300">
          Some settings changes may require a server restart to take effect.
          Make sure to restart the application after changing critical settings.
        </p>
      </div>
    </div>
  );
};

export default Settings;
