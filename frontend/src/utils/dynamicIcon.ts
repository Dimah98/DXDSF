import React from 'react';
import {
  Play, Globe, Scan, Search, CloudDownload, Database,
  GitFork, MousePointerClick, Crosshair, Keyboard,
  Camera, Layers, Monitor, Repeat, Move,
  MessageSquare, Timer, XCircle, Calculator, Activity,
  ArrowRightLeft, Package, Clock, CalendarClock, Bell,
  Sprout, Flame, ChefHat, Gamepad2, Hammer,
  Settings, Type, Flower, PackageCheck, Wallet,
  Map, Truck, LayoutGrid, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Square, Boxes, Images, HelpCircle, Trash2, Minimize2, Check, Copy, AlertTriangle,
  RotateCcw, RefreshCw, RefreshCwOff, ShieldAlert, Cpu
} from 'lucide-react';

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; fill?: string }>> = {
  Play, Globe, Scan, Search, CloudDownload, Database,
  GitFork, MousePointerClick, Crosshair, Keyboard,
  Camera, Layers, Monitor, Repeat, Move,
  MessageSquare, Timer, XCircle, Calculator, Activity,
  ArrowRightLeft, Package, Clock, CalendarClock, Bell,
  Sprout, Flame, ChefHat, Gamepad2, Hammer,
  Settings, Type, Flower, PackageCheck, Wallet,
  Map, Truck, LayoutGrid, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Square, Boxes, Images, HelpCircle, Trash2, Minimize2, Check, Copy, AlertTriangle,
  RotateCcw, RefreshCw, RefreshCwOff, ShieldAlert, Cpu
};

export function getDynamicIcon(name?: string): React.ComponentType<{ size?: number; className?: string; fill?: string }> | null {
  if (!name) return null;
  return ICON_MAP[name] || null;
}
