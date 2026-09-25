// Хук для збереження налаштувань запуску бота в localStorage
import { useState, useEffect, useCallback } from 'react';

// Типи режимів запуску
export type LaunchMode = 'single' | 'interval' | 'schedule';
export type IntervalUnit = 'minutes' | 'hours';

// Структура налаштувань запуску
export interface LaunchSettings {
  mode: LaunchMode;             // Режим запуску
  intervalValue: number;        // Числове значення інтервалу
  intervalUnit: IntervalUnit;   // Одиниця виміру інтервалу
  scheduleTime: string;         // Час за розкладом у форматі HH:MM
  scheduleDays: number[];       // Дні тижня (0=Нд, 1=Пн, ..., 6=Сб)
}

// Значення за замовчуванням
const DEFAULT_SETTINGS: LaunchSettings = {
  mode: 'single',
  intervalValue: 30,
  intervalUnit: 'minutes',
  scheduleTime: '09:00',
  scheduleDays: [1, 2, 3, 4, 5], // ПН-ПТ
};

export function useLaunchSettings(projectName: string | null = 'default') {
  const STORAGE_KEY = `sfl_launch_settings_${projectName || 'default'}`;

  // Завантажуємо з localStorage або беремо дефолтні значення
  const [settings, setSettings] = useState<LaunchSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Оновлюємо стан при зміні проекту (localStorage + сервер)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setSettings(saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }

    if (projectName && projectName !== 'default') {
      fetch(`/api/projects/${encodeURIComponent(projectName)}/settings`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.launchSettings && Object.keys(data.launchSettings).length > 0) {
            setSettings(prev => {
              const merged = { ...prev, ...data.launchSettings };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        })
        .catch(() => {});
    }
  }, [STORAGE_KEY, projectName]);

  // Автоматично зберігаємо при кожній зміні
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (projectName && projectName !== 'default') {
      const timer = setTimeout(() => {
        fetch(`/api/projects/${encodeURIComponent(projectName)}/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({ launchSettings: settings })
        }).catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [settings, STORAGE_KEY, projectName]);

  // Оновлення окремого поля
  const update = useCallback(<K extends keyof LaunchSettings>(key: K, value: LaunchSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Перемикання дня тижня у розкладі
  const toggleDay = useCallback((day: number) => {
    setSettings(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter(d => d !== day) // Видаляємо день
        : [...prev.scheduleDays, day].sort(),       // Додаємо день (відсортовано)
    }));
  }, []);

  return { settings, update, toggleDay };
}
