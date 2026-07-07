'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';

const STEPS = [
  {
    emoji: '🤔',
    heading: 'Whoa, hold on there.',
    body: "You're about to delete a screen. A real, actual screen that has been dutifully displaying your content. Have you considered... not doing that?",
    button: "I've considered it. Delete.",
  },
  {
    emoji: '😢',
    heading: "It served you well.",
    body: "This screen showed up every day. It never called in sick. It never asked for a pay rise. And now you want to delete it. Think about what you're doing.",
    button: "I know what I'm doing. Keep going.",
  },
  {
    emoji: '⚠️',
    heading: 'This CANNOT be undone.',
    body: "No undo button. No recycle bin. No 'restore from trash'. Once it's gone, it's gone. The screen record, its heartbeat history, its snapshot — all of it. Poof.",
    button: 'I understand. Proceed.',
  },
  {
    emoji: '🫣',
    heading: "Are you absolutely certain?",
    body: "Like, 100%? You haven't just had a bad day and are taking it out on the screens? Because that would be understandable, but also very sad.",
    button: "100%. Absolutely. Yes.",
  },
  {
    emoji: '🚨',
    heading: 'FINAL WARNING',
    body: "This is permanent. Irreversible. Eternal. The screen will cease to exist in this system. You'll need to re-pair it from scratch if you change your mind. The data does not come back.",
    button: "I accept the consequences. Do it.",
  },
  {
    emoji: '😤',
    heading: "Fine. One last chance.",
    body: "You could still close this dialog and pretend none of this happened. Nobody would know. The screen would still be here tomorrow morning, ready to work. Just saying.",
    button: "Close the dialog? Never. Delete it.",
  },
  {
    emoji: '💀',
    heading: "Last click. No going back.",
    body: "Seven confirmations. You've earned this. Click the button below and the screen is gone forever. We hope you're happy with yourself.",
    button: '☠️ DELETE THIS SCREEN FOREVER',
  },
];

export function DeleteScreenButton({ screenId, screenName }: { screenId: string; screenName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const del = trpc.screens.delete.useMutation({
    onSuccess: () => router.push('/screens'),
  });

  function handleOpen() {
    setStep(0);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleStep() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      del.mutate({ id: screenId });
    }
  }

  const current = STEPS[step];

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/40 hover:text-red-300 hover:border-red-700 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete screen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step counter */}
            <div className="flex gap-1 mb-5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-red-500' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">{current.emoji}</div>
              <h2 className="text-lg font-bold text-white mb-2">{current.heading}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{current.body}</p>
              {step === 0 && (
                <p className="mt-3 text-xs text-gray-600 font-mono">
                  &quot;{screenName}&quot;
                </p>
              )}
            </div>

            {/* Action button */}
            <button
              onClick={handleStep}
              disabled={del.isPending}
              className={`w-full rounded-xl py-3 px-4 text-sm font-semibold transition-all disabled:opacity-50 ${
                step === STEPS.length - 1
                  ? 'bg-red-600 hover:bg-red-500 text-white ring-2 ring-red-500/40'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
              }`}
            >
              {del.isPending ? 'Deleting...' : current.button}
            </button>

            {step > 0 && (
              <button
                onClick={handleClose}
                className="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
              >
                Actually, never mind — keep the screen
              </button>
            )}

            <p className="mt-4 text-center text-xs text-gray-700">
              Confirmation {step + 1} of {STEPS.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
