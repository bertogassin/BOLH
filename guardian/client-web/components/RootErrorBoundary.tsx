'use client'

import React from 'react'

export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RootErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1b26] text-white p-6">
          <p className="text-lg font-medium mb-2">Something went wrong</p>
          <p className="text-sm text-white/60 mb-4">The page could not load.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Go to home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
