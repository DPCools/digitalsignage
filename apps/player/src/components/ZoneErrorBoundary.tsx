'use client';
import React from 'react';
import { reportError } from '@/lib/api';

interface Props {
  zone: string;
  screenId: string;
  orgSlug: string;
  children: React.ReactNode;
}

interface State { hasError: boolean }

export class ZoneErrorBoundary extends React.Component<Props, State> {
  retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(this.props.orgSlug, this.props.screenId, this.props.zone, error.message, error.stack);
    // Auto-retry after 30 seconds
    this.retryTimer = setTimeout(() => this.setState({ hasError: false }), 30_000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      return <div className="w-full h-full bg-black" />;
    }
    return this.props.children;
  }
}
