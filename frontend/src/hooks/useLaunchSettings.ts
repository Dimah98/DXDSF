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

  // Оновлюємо стан при зміні проекту
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setSettings(saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [STORAGE_KEY]);

  // Автоматично зберігаємо при кожній зміні
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, STORAGE_KEY]);

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
