'use client';
import { getGridPreset } from '@signflow/types';
import { LegacyScreenLayout, type ScreenLayoutProps } from './LegacyScreenLayout';
import { GridScreenLayout } from './GridScreenLayout';

interface Props extends ScreenLayoutProps {
  layoutPreset?: string | null;
}

export function ScreenLayout({ layoutPreset, ...props }: Props) {
  const preset = getGridPreset(layoutPreset);
  if (!preset) return <LegacyScreenLayout {...props} />;
  return <GridScreenLayout preset={preset} {...props} />;
}
