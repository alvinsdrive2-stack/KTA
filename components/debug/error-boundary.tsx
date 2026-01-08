'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error)
    console.error('Error Info:', errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid red' }}>
          <h2>Something went wrong!</h2>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <p><strong>Stack:</strong></p>
          <pre style={{ fontSize: '12px', backgroundColor: '#fff', padding: '10px' }}>
            {this.state.error?.stack}
          </pre>
          <p><strong>Component Stack:</strong></p>
          <pre style={{ fontSize: '12px', backgroundColor: '#fff', padding: '10px' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}
