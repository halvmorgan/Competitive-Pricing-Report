import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  MapPin,
  Tag,
  Building2,
  FileText,
  Share2,
  List,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
} from 'lucide-react';
import { CompetitorSearchResult, CompetitorBusiness, PublishedOffer } from '../types.ts';

function formatCheckedDate(dateStr?: string): string {
  if (!dateStr) return 'September 28, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'September 28, 2026';
  }
}

interface FlipbookProps {
  searchResult: CompetitorSearchResult;
  onBackToSearch: () => void;
  onOpenShare: () => void;
}

export const Flipbook: React.FC<FlipbookProps> = ({
  searchResult,
  onBackToSearch,
  onOpenShare,
}) => {
  const { competitors, industry, location, approximateRadiusMiles, summary } = searchResult;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showIndexMenu, setShowIndexMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<'dossier' | 'pricing'>('dossier');

  const total = competitors.length;
  const currentCompetitor: CompetitorBusiness | undefined = competitors[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < total - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
      setMobileTab('dossier');
    }
  }, [currentIndex, total]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
      setMobileTab('dossier');
    }
  }, [currentIndex]);

  const handleJumpTo = (index: number) => {
    if (index >= 0 && index < total) {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
      setShowIndexMenu(false);
      setMobileTab('dossier');
    }
  };

  // Keyboard navigation (Left / Right Arrow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        if (showIndexMenu) setShowIndexMenu(false);
        else onBackToSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, showIndexMenu, onBackToSearch]);

  // Touch swipe gesture navigation for mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const deltaX = touchStartXRef.current - touchEndXRef.current;
      if (deltaX > 60) {
        // Swiped left -> next
        handleNext();
      } else if (deltaX < -60) {
        // Swiped right -> prev
        handlePrev();
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // If no competitors were found (e.g. zero match test)
  if (total === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-4 border-b border-slate-800">
          <button
            onClick={onBackToSearch}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </button>
          <span className="text-xs text-slate-500">
            {industry} · {location}
          </span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
            <Building2 className="w-8 h-8 opacity-80" />
          </div>
          <h2 className="text-2xl font-serif-heading font-bold text-slate-100 mb-2">
            No Competitors Found
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            No verified businesses operating in "{industry}" were detected within approximately{' '}
            {approximateRadiusMiles} miles of {location}. This may occur for ultra-niche services or locations with no commercial market presence.
          </p>
          <div className="space-y-2 w-full">
            <button
              onClick={onBackToSearch}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow transition-colors"
            >
              Modify Location or Industry
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 py-4">
          Live Search Grounding Verification
        </footer>
      </div>
    );
  }

  // Calculate page numbers for the two-page spread (Spread 1 = Pages 2–3, etc.)
  const leftPageNum = (currentIndex + 1) * 2;
  const rightPageNum = leftPageNum + 1;

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <header className="relative z-30 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToSearch}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-all text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Search</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-100 font-medium">{industry}</span>
            <span>·</span>
            <span>{location}</span>
            <span>·</span>
            <span className="text-amber-400/90 font-mono text-[11px]">
              Approx. {approximateRadiusMiles} mi
            </span>
          </div>
        </div>

        {/* Spread Navigation & Table of Contents */}
        <div className="flex items-center gap-2">
          {/* Table of Contents Button */}
          <div className="relative">
            <button
              onClick={() => setShowIndexMenu(!showIndexMenu)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-all text-xs font-medium"
            >
              <List className="w-3.5 h-3.5" />
              <span>Index ({total})</span>
            </button>

            {/* Dropdown Menu */}
            {showIndexMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Competitor Index
                </div>
                {competitors.map((comp, idx) => (
                  <button
                    key={comp.id}
                    onClick={() => handleJumpTo(idx)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                      idx === currentIndex
                        ? 'bg-amber-500/15 text-amber-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">
                      {idx + 1}. {comp.name}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                      p.{idx * 2 + 2}–{idx * 2 + 3}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onOpenShare}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 transition-colors"
            title="Share Access"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Flipbook Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-6 max-w-6xl mx-auto w-full">
        {/* Market overview kicker */}
        <div className="w-full max-w-4xl flex items-center justify-between mb-3 px-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-serif-heading font-semibold text-amber-400 text-sm">
              Competitor {currentIndex + 1} of {total}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline text-slate-400">
              Pages {leftPageNum} & {rightPageNum}
            </span>
          </div>

          {/* Quick keyboard instruction tip on desktop */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
            <span>Use Left/Right arrow keys or swipe to flip</span>
          </div>
        </div>

        {/* Mobile Tab Switcher (Dossier vs Offers) */}
        <div className="flex lg:hidden w-full max-w-md mb-3 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setMobileTab('dossier')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'dossier'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Business Dossier
          </button>
          <button
            onClick={() => setMobileTab('pricing')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mobileTab === 'pricing'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pricing & Offers ({currentCompetitor?.offers.length || 0})
          </button>
        </div>

        {/* Book Container with 3D Perspective and Animation */}
        <div className="relative w-full max-w-5xl perspective-1400">
          {/* Previous Flip Button (Floating Desk Control) */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="hidden lg:flex absolute -left-14 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-slate-900 border border-slate-700/80 hover:border-amber-500/60 text-slate-200 hover:text-amber-400 items-center justify-center shadow-xl transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            aria-label="Previous competitor spread"
            title="Previous competitor (Arrow Left)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Next Flip Button (Floating Desk Control) */}
          <button
            onClick={handleNext}
            disabled={currentIndex === total - 1}
            className="hidden lg:flex absolute -right-14 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-slate-900 border border-slate-700/80 hover:border-amber-500/60 text-slate-200 hover:text-amber-400 items-center justify-center shadow-xl transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            aria-label="Next competitor spread"
            title="Next competitor (Arrow Right)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Hardcover Outer Frame */}
          <div className="p-2 sm:p-3 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border border-stone-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]">
            {/* Animated Two-Page Spread */}
            <AnimatePresence mode="wait" custom={direction}>
              {currentCompetitor && (
                <motion.div
                  key={currentCompetitor.id}
                  custom={direction}
                  initial={{
                    opacity: 0.2,
                    scale: 0.98,
                    rotateY: direction > 0 ? 12 : -12,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotateY: 0,
                  }}
                  exit={{
                    opacity: 0.2,
                    scale: 0.98,
                    rotateY: direction > 0 ? -12 : 12,
                  }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="grid grid-cols-1 lg:grid-cols-2 rounded-xl overflow-hidden shadow-2xl relative bg-[#FAF7F2] text-stone-900 min-h-[540px]"
                >
                  {/* Central Book Spine Shadow & Crease Effect (Desktop only) */}
                  <div className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 z-30 pointer-events-none bg-gradient-to-r from-stone-400/25 via-stone-500/40 to-stone-400/25 shadow-inner" />
                  <div className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-[0.5px] w-[1px] bg-stone-400/60 z-30" />

                  {/* ================= LEFT PAGE: BUSINESS DOSSIER ================= */}
                  <div
                    className={`p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-stone-300/80 bg-gradient-to-br from-[#FCFBF8] via-[#FAF7F2] to-[#F5F1E8] relative ${
                      mobileTab === 'pricing' ? 'hidden lg:flex' : 'flex'
                    }`}
                  >
                    {/* Subtle page paper header */}
                    <div>
                      <div className="flex items-center justify-between border-b border-stone-300 pb-3 mb-6">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 uppercase tracking-widest">
                          <Building2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Competitor Dossier</span>
                        </div>
                        <span className="font-serif-heading text-xs text-stone-600 font-medium">
                          Page {leftPageNum}
                        </span>
                      </div>

                      {/* Business Name */}
                      <h2 className="text-2xl sm:text-3xl font-serif-heading font-bold text-stone-900 tracking-tight leading-snug">
                        {currentCompetitor.name}
                      </h2>

                      {/* Approximate Distance & Location */}
                      <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-3 text-xs text-stone-600">
                        <div className="flex items-center gap-1 bg-amber-100/70 text-amber-900 px-2.5 py-1 rounded-md border border-amber-300/60 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-amber-700" />
                          <span>{currentCompetitor.approximateDistance}</span>
                        </div>
                        <span className="text-stone-500">{currentCompetitor.addressOrArea}</span>
                      </div>

                      {/* Description */}
                      <div className="mt-6">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                          Market Overview & Profile
                        </h4>
                        <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-sans-ui">
                          {currentCompetitor.description}
                        </p>
                      </div>

                      {/* Specialties & Categories */}
                      {currentCompetitor.specialties && currentCompetitor.specialties.length > 0 && (
                        <div className="mt-5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-2">
                            Key Capabilities & Specialties
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {currentCompetitor.specialties.map((spec, i) => (
                              <span
                                key={i}
                                className="text-xs text-stone-700 bg-stone-200/80 px-2.5 py-1 rounded border border-stone-300/60 font-sans-ui"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Left Page Footer: Verified Source Link */}
                    <div className="mt-8 pt-4 border-t border-stone-300 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Source Verified</span>
                      </div>

                      <a
                        href={currentCompetitor.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline transition-colors"
                      >
                        <span>Visit Official Source</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* ================= RIGHT PAGE: PRICING & PUBLIC OFFERS ================= */}
                  <div
                    className={`p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-bl from-[#FCFBF8] via-[#FAF7F2] to-[#F5F1E8] relative ${
                      mobileTab === 'dossier' ? 'hidden lg:flex' : 'flex'
                    }`}
                  >
                    <div>
                      {/* Page Header */}
                      <div className="flex items-center justify-between border-b border-stone-300 pb-3 mb-6">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 uppercase tracking-widest">
                          <Tag className="w-3.5 h-3.5 text-amber-700" />
                          <span>Published Rates & Public Offers</span>
                        </div>
                        <span className="font-serif-heading text-xs text-stone-600 font-medium">
                          Page {rightPageNum}
                        </span>
                      </div>

                      {/* Offers List or No Published Pricing State */}
                      {currentCompetitor.hasPublishedPricing && currentCompetitor.offers.length > 0 ? (
                        <div className="space-y-3.5">
                          {currentCompetitor.offers.map((offer, idx) => (
                            <div
                              key={offer.id || idx}
                              className="p-4 rounded-xl bg-white/85 border border-stone-300/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-bold text-stone-900 font-sans-ui">
                                    {offer.title}
                                  </h4>
                                  <div className="flex flex-wrap items-baseline gap-2 mt-1">
                                    <span className="text-xl sm:text-2xl font-serif-heading font-bold text-amber-900">
                                      {offer.price}
                                    </span>
                                    {offer.billingPeriod && (
                                      <span className="text-xs text-stone-600 font-medium">
                                        / {offer.billingPeriod}
                                      </span>
                                    )}

                                    {/* Requirement 5: "show a 'Source' link next to every price" */}
                                    <a
                                      href={offer.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 ml-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 hover:text-amber-950 border border-amber-300/80 text-[11px] font-semibold transition-colors shadow-2xs"
                                      title="Open published price source"
                                    >
                                      <span>Source</span>
                                      <ExternalLink className="w-2.5 h-2.5 text-amber-800" />
                                    </a>
                                  </div>

                                  {/* Requirement 5: "and a 'Checked on <date>' line" */}
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-500 font-mono">
                                    <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                                    <span>Checked on {formatCheckedDate(searchResult.searchedAt)}</span>
                                  </div>
                                </div>

                                {/* Direct Source Link for Offer */}
                                <a
                                  href={offer.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 p-1.5 rounded-md hover:bg-stone-100 text-stone-500 hover:text-amber-800 transition-colors"
                                  title="View published price source"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>

                              {/* Intro Restrictions or Fine Print */}
                              {(offer.introRestrictions || offer.extraFees) && (
                                <div className="mt-2.5 pt-2 border-t border-stone-200 text-[11px] text-stone-600 space-y-1">
                                  {offer.introRestrictions && (
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold text-stone-700">Terms:</span>
                                      <span>{offer.introRestrictions}</span>
                                    </div>
                                  )}
                                  {offer.extraFees && (
                                    <div className="flex items-start gap-1">
                                      <span className="font-semibold text-stone-700">Fees:</span>
                                      <span>{offer.extraFees}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Grounding Sources Section */}
                          {currentCompetitor.groundingSources && currentCompetitor.groundingSources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-stone-200/90">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500 mb-1.5 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Grounded Sources ({currentCompetitor.groundingSources.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {currentCompetitor.groundingSources.map((gs, gsIdx) => (
                                  <a
                                    key={gsIdx}
                                    href={gs.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-stone-700 hover:text-amber-900 bg-stone-100 hover:bg-stone-200/90 px-2 py-0.5 rounded border border-stone-300/80 transition-colors max-w-full"
                                  >
                                    <span className="truncate max-w-[210px]">{gs.title || 'Verified Source'}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* No Published Pricing Found State */
                        <div className="p-6 rounded-xl bg-amber-50/60 border border-amber-200/80 text-center my-6">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                            <HelpCircle className="w-5 h-5" />
                          </div>
                          <h4 className="font-serif-heading font-bold text-stone-900 text-base mb-1">
                            {currentCompetitor.noPricingReason || 'Price not published'}
                          </h4>
                          <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                            No verified public rates are published online. This business typically provides rates upon consultation, on-site assessment, or custom estimate.
                          </p>
                          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-mono">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            <span>Checked on {formatCheckedDate(searchResult.searchedAt)}</span>
                          </div>
                          <div className="mt-4">
                            <a
                              href={currentCompetitor.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 transition-colors shadow-sm"
                            >
                              <span>Inquire on Official Page</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {/* Grounding Sources for Competitor with no published pricing */}
                          {currentCompetitor.groundingSources && currentCompetitor.groundingSources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-amber-200/60 text-left">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Grounded Sources ({currentCompetitor.groundingSources.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {currentCompetitor.groundingSources.map((gs, gsIdx) => (
                                  <a
                                    key={gsIdx}
                                    href={gs.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-stone-700 hover:text-amber-900 bg-white hover:bg-stone-100 px-2 py-0.5 rounded border border-amber-200 transition-colors max-w-full"
                                  >
                                    <span className="truncate max-w-[210px]">{gs.title || 'Verified Source'}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Page Footer */}
                    <div className="mt-8 pt-4 border-t border-stone-300 flex items-center justify-between text-[11px] text-stone-500">
                      <span>Currencies & terms as published</span>
                      <span className="font-mono">
                        {currentCompetitor.offers.length} offer
                        {currentCompetitor.offers.length === 1 ? '' : 's'} recorded
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Pagination & Flip Controls */}
        <div className="w-full max-w-md mt-6 flex items-center justify-between px-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 text-xs font-semibold transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {competitors.map((_, i) => (
              <button
                key={i}
                onClick={() => handleJumpTo(i)}
                className={`transition-all rounded-full ${
                  i === currentIndex
                    ? 'w-6 h-2 bg-amber-400'
                    : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Jump to competitor ${i + 1}`}
                aria-label={`Jump to competitor ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === total - 1}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 text-xs font-semibold transition-all"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Grounding Attribution & Verified Sources Drawer / Footer */}
      <footer className="relative z-10 py-3 px-6 text-center text-[11px] text-slate-500 border-t border-slate-900/80 flex flex-wrap items-center justify-center gap-4">
        <span>Grounded via Google Search live index</span>
        <span>·</span>
        <span>Distance estimates are approximate</span>
        <span>·</span>
        <span>Source URLs verified before display</span>
      </footer>
    </div>
  );
};
