import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-red-300">
                  {this.props.fallbackTitle || 'Сталася помилка відображення'}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {this.state.error?.message || 'Невідома помилка компонента'}
                </p>
              </div>
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Закрити"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-red-300/90 max-h-48 overflow-y-auto mb-5 break-all select-text">
              {this.state.error?.stack || this.state.error?.toString()}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Закрити
                </button>
              )}
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all"
              >
                <RefreshCw size={13} />
                <span>Спробувати знову</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
