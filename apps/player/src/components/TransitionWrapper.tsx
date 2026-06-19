'use client';
import { useEffect, useRef, useState } from 'react';
import type { TransitionType } from '@signflow/types';

const TRANSITION_CLASSES: Record<TransitionType, { out: string; in: string }> = {
  FADE: { out: 'opacity-0', in: 'opacity-100 transition-opacity duration-700' },
  SLIDE_LEFT: { out: '-translate-x-full', in: 'translate-x-0 transition-transform duration-500' },
  SLIDE_RIGHT: { out: 'translate-x-full', in: 'translate-x-0 transition-transform duration-500' },
  ZOOM: { out: 'scale-110 opacity-0', in: 'scale-100 opacity-100 transition-all duration-600' },
  NONE: { out: '', in: '' },
};

export function TransitionWrapper({
  children,
  transitionType,
  itemKey,
}: {
  children: React.ReactNode;
  transitionType: TransitionType;
  itemKey: string;
}) {
  const [cls, setCls] = useState('');
  const prevKey = useRef(itemKey);

  useEffect(() => {
    if (prevKey.current === itemKey) return;
    prevKey.current = itemKey;
    const { out, in: inCls } = TRANSITION_CLASSES[transitionType];
    setCls(out);
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setCls(inCls));
    });
    return () => { cancelAnimationFrame(outerRaf); cancelAnimationFrame(innerRaf); };
  }, [itemKey, transitionType]);

  return <div className={`relative w-full h-full ${cls}`}>{children}</div>;
}
