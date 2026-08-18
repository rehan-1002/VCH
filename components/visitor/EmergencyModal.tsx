"use client";

import React, { useState } from "react";
import { AlertCircle, X, ShieldAlert, Check } from "lucide-react";
import { Button } from "../ui/Button";

interface EmergencyModalProps {
  tokenId: string;
  displayNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function EmergencyModal({
  tokenId,
  displayNumber,
  isOpen,
  onClose,
  onSubmitted,
}: EmergencyModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for the priority review request.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit request");
      }

      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit emergency request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-sm font-mono uppercase font-bold tracking-wider text-zinc-100">
              Request Priority Review
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 text-xs text-zinc-400 leading-relaxed">
          Submitting this request alerts the queue administration for exception handling.
          <strong className="text-zinc-200 ml-1">
            Priority is not guaranteed and requires explicit administrative approval.
          </strong>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded border border-red-800/80 bg-red-950/40 p-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Token Reference
            </label>
            <input
              type="text"
              readOnly
              value={displayNumber}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-mono font-bold text-zinc-200 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Reason / Medical or Operational Need
            </label>
            <textarea
              rows={3}
              required
              placeholder="E.g., Medical urgency, accessibility accommodation, urgent deadline..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-red-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" isLoading={isSubmitting}>
              Submit for Review
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
