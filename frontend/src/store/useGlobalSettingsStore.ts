import { create } from 'zustand';

interface GlobalSettingsState {
  settings: Record<string, any>;
  setGlobalSettings: (settings: Record<string, any>) => void;
  updateGlobalSetting: (key: string, value: any) => void;
}

export const useGlobalSettingsStore = create<GlobalSettingsState>((set) => ({
  settings: {},
  setGlobalSettings: (settings) => set({ settings }),
  updateGlobalSetting: (key, value) => set((state) => ({
    settings: { ...state.settings, [key]: value },
  })),
}));
