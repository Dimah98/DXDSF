/**
 * ConfigSettings Component
 * 
 * Provides UI for viewing and updating global configuration
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

interface ConfigData {
  route: string;
  value: number;
}

interface ConfigSettingsProps {
  onClose?: () => void;
}

export const ConfigSettings: React.FC<ConfigSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<ConfigData>({ route: '', value: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Fetch current config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/config');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to fetch config:', err);
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Clear previous messages
    setError(null);
    setSuccess(false);

    // Client-side validation for number input
    if (typeof config.value !== 'number' || isNaN(config.value)) {
      setError('Value must be a valid number');
      return;
    }

    setSaving(true);

    try {
      // Get JWT token from localStorage (optional - will try without if not found)
      const token = localStorage.getItem('jwt_token');
      
      // Get CSRF token from meta tag or cookie (optional)
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                        getCookie('csrf_token');

      // Build headers (only include auth headers if tokens exist)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // Send PUT request
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          route: config.route,
          value: config.value
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      setSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save config:', err);
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRouteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, route: e.target.value }));
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    setConfig(prev => ({ ...prev, value: isNaN(numValue) ? 0 : numValue }));
  };

  // Helper function to get cookie value by name
  const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  };

  return (
    <div className="config-settings">
      {loading && (
        <div className="mb-3 text-xs text-slate-400">
          Завантаження конфігурації...
        </div>
      )}

      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-xs">
          <strong>Помилка:</strong> {error}
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg text-xs">
          <strong>Успішно!</strong> Конфігурацію оновлено.
        </div>
      )}

      <div className="space-y-3">
        {/* Route input field */}
        <div>
          <Label htmlFor="config-route" className="text-[10px] font-medium text-slate-300">Маршрут (Route)</Label>
          <Input
            id="config-route"
            type="text"
            value={config.route}
            onChange={handleRouteChange}
            placeholder="Введіть маршрут"
            disabled={loading || saving}
            className="w-full mt-1 bg-black/30 border-white/10 text-slate-200 text-xs"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Максимум 256 символів
          </p>
        </div>

        {/* Value input field */}
        <div>
          <Label htmlFor="config-value" className="text-[10px] font-medium text-slate-300">Значення (Value)</Label>
          <Input
            id="config-value"
            type="number"
            value={config.value}
            onChange={handleValueChange}
            placeholder="Введіть число"
            disabled={loading || saving}
            className="w-full mt-1 bg-black/30 border-white/10 text-slate-200 text-xs"
            step="any"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Має бути числом
          </p>
        </div>

        {/* Save button */}
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={loading || saving}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2"
          >
            {saving ? 'Збереження...' : 'Зберегти конфігурацію'}
          </Button>
        </div>
      </div>

      {/* Display current config values */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Поточна конфігурація</h4>
        <div className="bg-black/40 p-3 rounded-lg font-mono text-[10px] space-y-1">
          <div className="text-slate-300"><span className="text-slate-500">Route:</span> {config.route || '(порожньо)'}</div>
          <div className="text-slate-300"><span className="text-slate-500">Value:</span> {config.value}</div>
        </div>
      </div>
    </div>
  );
};
