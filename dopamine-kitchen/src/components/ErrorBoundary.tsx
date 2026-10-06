import { Component, type ReactNode } from 'react'

// Catches render errors anywhere in the app and offers recovery (including a data reset,
// in case locally stored simulation data was corrupted).
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50 p-6">
        <div className="card max-w-md p-8 text-center">
          <div className="text-5xl">🫠</div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-500">The simulation hit an unexpected error. You can reload, or reset the demo data if the problem keeps happening.</p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-xl bg-ink-100 p-3 text-left text-xs text-ink-700">{this.state.error.message}</pre>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn btn-primary" onClick={() => { try { localStorage.removeItem('pikk-v1') } catch { /* storage unavailable */ } window.location.hash = '#/'; window.location.reload() }}>Reset demo data</button>
          </div>
        </div>
      </div>
    )
  }
}
