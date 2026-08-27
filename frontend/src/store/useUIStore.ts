import { create } from 'zustand';

interface UIState {
  isConfigManagerOpen: boolean;
  openConfigManager: () => void;
  closeConfigManager: () => void;
  setConfigManagerOpen: (open: boolean) => void;

  unreadNotificationsCount: number;
  setUnreadNotificationsCount: (count: number) => void;

  nodeColors: Record<string, string>;
  setNodeColors: (colors: Record<string, string>) => void;

  nodeIcons: Record<string, string>;
  setNodeIcons: (icons: Record<string, string>) => void;

  addNodeTapType: string | null;
  triggerAddNodeTap: (type: string) => void;
  clearAddNodeTap: () => void;

  lastSavedScreenshot: any | null;
  setLastSavedScreenshot: (screenshot: any) => void;

  saveLogsRequest: { projectName: string; timestamp: number } | null;
  requestSaveLogs: (projectName: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isConfigManagerOpen: false,
  openConfigManager: () => set({ isConfigManagerOpen: true }),
  closeConfigManager: () => set({ isConfigManagerOpen: false }),
  setConfigManagerOpen: (open) => set({ isConfigManagerOpen: open }),

  unreadNotificationsCount: 0,
  setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),

  nodeColors: {},
  setNodeColors: (colors) => set({ nodeColors: colors }),

  nodeIcons: {},
  setNodeIcons: (icons) => set({ nodeIcons: icons }),

  addNodeTapType: null,
  triggerAddNodeTap: (type) => set({ addNodeTapType: type }),
  clearAddNodeTap: () => set({ addNodeTapType: null }),

  lastSavedScreenshot: null,
  setLastSavedScreenshot: (screenshot) => set({ lastSavedScreenshot: screenshot }),

  saveLogsRequest: null,
  requestSaveLogs: (projectName) => set({ saveLogsRequest: { projectName, timestamp: Date.now() } }),
}));
