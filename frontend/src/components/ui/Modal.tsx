"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className="w-full max-w-md rounded-2xl p-6 shadow-xl"
          style={{
            background: "var(--night-raised)",
            border: "1px solid var(--night-border)",
          }}
        >
          {title && (
            <DialogTitle
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--night-text)" }}
            >
              {title}
            </DialogTitle>
          )}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
