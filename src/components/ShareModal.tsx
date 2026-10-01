import React, { useState } from 'react';
import { X, Copy, Check, Share2, Shield } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, currentUserEmail }) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const shareUrl = window.location.origin;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif-heading font-semibold text-slate-100 text-lg">
              Share Access with Team
            </h3>
            <p className="text-xs text-slate-400">
              Send a teammate the link. Give them the passcode separately (by phone or text).
            </p>
          </div>
        </div>

        <div className="space-y-4 my-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              App Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 truncate focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              They will be asked for the passcode when they open it.
            </p>
          </div>

        </div>

        <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-[11px] text-slate-400 flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
          <span>
            Only people with the passcode can run searches. To change the passcode, update the APP_ACCESS_PASSCODE secret in AI Studio.
          </span>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
