import { Component } from 'react'

// Without this, any error while drawing the app unmounts everything and leaves
// a black screen. Show a way back instead.
export default class CrashGuard extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="fixed inset-0 lacquer flex items-center justify-center p-6">
        <div role="alert" className="panel w-full max-w-sm rounded-[24px] p-6 text-center">
          <p className="eyebrow mb-2">Something went wrong</p>
          <h2 className="text-xl font-bold text-paper leading-tight mb-2">The table didn’t load</h2>
          <p className="text-sm text-paper/70 mb-5">Reload to get the latest version. Your game is saved, so you can pick it up from the home screen.</p>
          <button onClick={() => window.location.reload()} className="btn btn-gold w-full">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
