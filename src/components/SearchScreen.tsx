import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Sliders, Sparkles, Building2, AlertCircle, Share2, LogOut, Check } from 'lucide-react';
import { AuthSession } from '../types.ts';

interface SearchScreenProps {
  onSearch: (industry: string, location: string, radiusMiles: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  authSession: AuthSession | null;
  onOpenShare: () => void;
  onSignOut: () => void;
}

const POPULAR_INDUSTRIES = [
  'Pilates & Lagree Studio',
  'Plumbing & Rooter Services',
  'Boutique Coworking Spaces',
  'Dental Teeth Whitening & Cosmetic',
  'Specialty Coffee Roasters',
  'Auto Detailing & Ceramic Coating',
  'Commercial HVAC & Refrigeration',
  'Residential Roofing Contractors',
  'Veterinary Clinic & Pet Urgent Care',
  'Personal Training & Fitness Gym',
  'Medical Spa & Aesthetics',
  'Commercial Office Cleaning',
  'Deep Sea Submersible Rental',
];

const POPULAR_LOCATIONS = [
  'Austin, TX',
  'Denver, CO',
  'Chicago, IL',
  'Miami, FL',
  'Seattle, WA',
  'Nashville, TN',
  '78701',
  '90210',
];

const PRESET_TEST_CASES = [
  {
    label: 'Plumber',
    location: 'Charlotte, NC',
    radius: 15,
    tag: 'Home Service & Flat-Rate Pricing',
  },
  {
    label: 'Pilates Studio',
    location: 'Austin, TX',
    radius: 15,
    tag: 'Standard Consumer Niche',
  },
  {
    label: 'Commercial HVAC Installation',
    location: 'Chicago, IL',
    radius: 25,
    tag: 'Test: Niche with Custom Quotes',
  },
  {
    label: 'Deep Sea Submersible Rental',
    location: 'Omaha, NE',
    radius: 10,
    tag: 'Test: Zero Competitors',
  },
];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onSearch,
  isLoading,
  error,
  authSession,
  onOpenShare,
  onSignOut,
}) => {
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const industryInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cycling loading message to provide rich feedback during live search grounding
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 2800);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        industryInputRef.current &&
        !industryInputRef.current.contains(e.target as Node)
      ) {
        setShowIndustryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIndustries = POPULAR_INDUSTRIES.filter((item) =>
    item.toLowerCase().includes(industry.toLowerCase().trim()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !location.trim() || isLoading) return;
    setShowIndustryDropdown(false);
    onSearch(industry.trim(), location.trim(), radiusMiles);
  };

  const handleApplyPreset = (preset: typeof PRESET_TEST_CASES[0]) => {
    setIndustry(preset.label);
    setLocation(preset.location);
    setRadiusMiles(preset.radius);
    setShowIndustryDropdown(false);
    onSearch(preset.label, preset.location, preset.radius);
  };

  const loadingMessages = [
    'Scanning Google Search for real active local competitors...',
    'Inspecting published websites for pricing tables and rate cards...',
    'Extracting public package terms, currencies, and billing cycles...',
    'Assembling your two-page competitive intelligence flipbook...',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background radial gradient & texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(180,134,58,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Top Bar with Brand & Auth Status */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif-heading font-bold text-sm">
            CP
          </div>
          <div>
            <span className="font-serif-heading font-semibold text-slate-200 text-sm tracking-wide">
              Competitive Pricing Offer Analysis
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {authSession && (
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <span>Signed in as</span>
              <span className="text-slate-200 font-medium">{authSession.email || 'Team Member'}</span>
            </div>
          )}

          <button
            onClick={onOpenShare}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-all text-xs font-medium"
            title="Share access with your team or clients"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share Portal</span>
          </button>

          <button
            onClick={onSignOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-2xl mx-auto w-full">
        {/* Title and subtitle */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400/90 font-medium tracking-wider uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Real Local Grounded Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-heading font-bold text-slate-100 tracking-tight leading-tight">
            Discover Real Local Competitor Pricing & Offers
          </h1>
          <p className="text-sm text-slate-400 mt-3 max-w-lg mx-auto leading-relaxed">
            Search live public rates, packages, and membership tiers for local businesses within your target market radius—presented in a curated flipbook spread.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-300 mb-0.5">Search Issue</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Search Card */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Industry Input with Autocomplete */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Industry or Niche
              </label>
              <div className="relative">
                <input
                  ref={industryInputRef}
                  type="text"
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    setShowIndustryDropdown(true);
                  }}
                  onFocus={() => setShowIndustryDropdown(true)}
                  placeholder="e.g. Pilates Studio, Roofing Contractor, Dental Clinic..."
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-50"
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>

              {/* Autocomplete Dropdown */}
              {showIndustryDropdown && filteredIndustries.length > 0 && !isLoading && (
                <div
                  ref={dropdownRef}
                  className="absolute z-30 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto py-1"
                >
                  <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 border-b border-slate-800">
                    Suggested Niches (or type any custom niche)
                  </div>
                  {filteredIndustries.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setIndustry(item);
                        setShowIndustryDropdown(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 flex items-center justify-between transition-colors"
                    >
                      <span>{item}</span>
                      {industry.toLowerCase() === item.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location: City or ZIP */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                City or ZIP Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX or 78701"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-50"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>

              {/* Quick location chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[11px] text-slate-500 mr-1">Quick:</span>
                {POPULAR_LOCATIONS.slice(0, 5).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    disabled={isLoading}
                    className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-amber-300 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded transition-colors"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Approximate Radius (1–50 miles) */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Approximate Search Radius
                  </label>
                </div>
                <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Approx. {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(parseInt(e.target.value, 10))}
                disabled={isLoading}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>1 mile (hyper-local)</span>
                <span>25 miles</span>
                <span>50 miles (regional)</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !industry.trim() || !location.trim()}
              className="w-full mt-3 py-3.5 px-6 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Searching Live Competitors...</span>
                </div>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Find Competitors & Public Pricing</span>
                </>
              )}
            </button>
          </form>

          {/* Active loading state indicator */}
          {isLoading && (
            <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-amber-500/30 text-center animate-pulse">
              <p className="text-xs font-medium text-amber-300">
                {loadingMessages[loadingStep]}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Grounding against live web records to prevent hallucinations.
              </p>
            </div>
          )}
        </div>

        {/* Real Test Scenarios */}
        <div className="w-full mt-8 pt-6 border-t border-slate-800/80">
          <div className="text-center mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Live Test Scenarios
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_TEST_CASES.map((preset) => (
              <button
                key={preset.label + preset.location}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                disabled={isLoading}
                className="p-3 text-left bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 rounded-xl transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-200 group-hover:text-amber-300">
                  <span>{preset.label}</span>
                  <span className="text-[11px] text-slate-400">{preset.location}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {preset.tag} · Approx. {preset.radius} mi
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 px-6 text-center text-[11px] text-slate-500 border-t border-slate-900">
        <span>Grounded in live search results · Exact published prices & direct source links</span>
      </footer>
    </div>
  );
};
