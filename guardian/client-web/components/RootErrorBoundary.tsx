'use client'

import React from 'react'

const COPY = {
  en: {
    title: 'Something went wrong',
    subtitle: 'The page could not load.',
    retry: 'Try again',
    home: 'Go to home',
  },
  ru: {
    title: 'Что-то пошло не так',
    subtitle: 'Страница не загрузилась.',
    retry: 'Повторить',
    home: 'На главную',
  },
} as const

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
    const locale =
      typeof window !== 'undefined' && window.localStorage.getItem('guardian_locale') === 'ru'
        ? 'ru'
        : 'en'
    const copy = COPY[locale]

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1b26] text-white p-6">
          <p className="text-lg font-medium mb-2">{copy.title}</p>
          <p className="text-sm text-white/60 mb-4">{copy.subtitle}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
          >
            {copy.retry}
          </button>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            {copy.home}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
