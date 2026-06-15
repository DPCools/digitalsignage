import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// shadcn components are added here via: pnpm dlx shadcn@latest add <component>
// Run from apps/admin with components.json pointing output to packages/ui/src/
