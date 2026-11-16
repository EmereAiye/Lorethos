import React from 'react';
import { useApp } from '../context/AppContext';
import { Check, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react';

export const PricingView: React.FC = () => {
  const { openPaystackCheckout, user, isAuthenticated, navigate, buildHref, stories } = useApp();
  const isPatron = isAuthenticated && user.subscription.status === 'active';

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-16 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
            Membership &amp; Individual Story Unlocks
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
            Membership &amp; Pricing
          </h1>
          <p className="font-reader text-base sm:text-lg text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
            Start with complimentary opening chapters on every title, subscribe for full catalog access, or unlock individual stories one by one.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

          {/* Tier 1: Free Reader */}
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col justify-between shadow-xs">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                  Open Access
                </span>
                <h2 className="font-display text-2xl font-bold mt-1">Free Reader</h2>
                <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader mt-2">
                  Read opening chapters across published stories before subscribing or purchasing.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold">₦0</span>
                <span className="text-xs text-[#2D142C]/60 dark:text-white/60 ml-1">/ free chapters</span>
              </div>

              <div className="space-y-3 text-xs text-[#2D142C]/80 dark:text-white/80 font-sans-ui pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chapters 1&ndash;3 free across catalog stories</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Day, Sepia, and Night reading themes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Font size &amp; reading width customization</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <a
                href={buildHref('stories')}
                onClick={(e) => handleLink(e, 'stories')}
                className="w-full py-3 px-4 rounded-lg border border-[#2D142C]/20 dark:border-white/20 text-xs font-semibold hover:border-[#C85A32] hover:text-[#C85A32] transition-colors flex items-center justify-center"
              >
                Browse Free Chapters
              </a>
            </div>
          </div>

          {/* Tier 2: Monthly Plan */}
          <div className="p-8 rounded-2xl bg-[#2D142C] text-[#F9F6F0] border-2 border-[#C85A32] flex flex-col justify-between shadow-2xl relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C85A32] text-white text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm font-sans-ui">
              Monthly Plan
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                  Subscription Catalog Access
                </span>
                <h2 className="font-display text-2xl font-bold text-white mt-1">
                  Patron Monthly
                </h2>
                <p className="text-xs text-white/75 font-reader mt-2">
                  Unlock all subscription series, reader audio tools, and account-synced highlights.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold text-white tabular-nums">₦3,500</span>
                <span className="text-xs text-white/65 ml-1">/ month</span>
              </div>

              <div className="space-y-3 text-xs text-white/90 font-sans-ui pt-2 border-t border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Full chapter access across subscription stories</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>AI voice narration and chapter Q&amp;A companion</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Ambient reader audio soundscapes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Cancel anytime from your Account page</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={() =>
                  openPaystackCheckout({
                    type: 'subscription',
                    title: 'Patron Monthly Subscription',
                    amountNgn: 3500,
                    planId: 'monthly'
                  })
                }
                className="w-full py-3.5 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <span>{isPatron ? 'Renew Monthly Plan (₦3,500)' : 'Subscribe via Paystack (₦3,500)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tier 3: Annual Plan */}
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col justify-between shadow-xs">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                  12-Month Pass
                </span>
                <h2 className="font-display text-2xl font-bold mt-1">Patron Annual</h2>
                <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader mt-2">
                  Twelve full months of subscription access with annual billing savings.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold tabular-nums">₦32,000</span>
                <span className="text-xs text-[#2D142C]/60 dark:text-white/60 ml-1">/ year</span>
                <div className="text-[11px] text-[#C85A32] font-semibold mt-0.5">
                  Save ₦10,000 compared to 12 monthly payments
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#2D142C]/80 dark:text-white/80 font-sans-ui pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Everything included in Monthly Plan</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Full year of uninterrupted subscription access</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Synced bookmarks, highlights &amp; reading goals</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={() =>
                  openPaystackCheckout({
                    type: 'subscription',
                    title: 'Patron Annual Subscription (12 Months)',
                    amountNgn: 32000,
                    planId: 'annual'
                  })
                }
                className="w-full py-3 px-4 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Subscribe Annual (₦32,000)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Single-Story Purchases */}
        <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-wider uppercase text-[#C85A32] font-sans-ui">
                One-Time Purchase
              </div>
              <h2 className="font-display text-2xl font-bold mt-1">
                Unlock Individual Stories
              </h2>
              <p className="font-reader text-xs sm:text-sm text-[#2D142C]/70 dark:text-white/70 mt-1 max-w-xl">
                Prefer to buy a single title instead of a recurring plan? Unlock any story once to keep reading all published chapters.
              </p>
            </div>
            <a
              href={buildHref('stories')}
              onClick={(e) => handleLink(e, 'stories')}
              className="text-xs font-semibold text-[#C85A32] hover:underline self-start sm:self-auto shrink-0"
            >
              Browse Catalog &rarr;
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {stories.map(s => (
              <div
                key={s.id}
                className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold truncate">{s.title}</h3>
                  <div className="text-[11px] text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    ₦{s.priceNgn.toLocaleString('en-NG')} one-time
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openPaystackCheckout({
                      type: 'book_purchase',
                      title: `Book Unlock: ${s.title}`,
                      amountNgn: s.priceNgn,
                      storyId: s.id
                    })
                  }
                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#C85A32] text-white rounded hover:bg-[#b04d28] cursor-pointer shrink-0"
                >
                  Unlock
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods & FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4">

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#C85A32] font-sans-ui">
              <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
              <span>Payment methods</span>
            </div>
            <h2 className="font-display text-2xl font-bold">
              Hosted Checkout via Paystack
            </h2>
            <p className="font-reader text-xs sm:text-sm text-[#2D142C]/75 dark:text-white/75 leading-relaxed">
              Lorethos initializes every order on our server and redirects you to Paystack&apos;s official hosted checkout page in Nigerian Naira (₦). Access is granted only after Paystack verifies settlement.
            </p>
            <ul className="space-y-2 text-xs font-sans-ui text-[#2D142C]/80 dark:text-white/80">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Nigerian and international cards supported by Paystack.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Direct bank transfers and USSD options inside Paystack checkout.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Server-verified transaction receipts stored in your account ledger.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#C85A32] font-sans-ui">
              <HelpCircle className="w-4 h-4 text-[#C85A32]" />
              <span>Frequently Asked Questions</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-1">
                <h3 className="font-semibold text-sm">Can I cancel my monthly or annual subscription?</h3>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  Yes. You can cancel your subscription status directly from your Account page at any time.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-1">
                <h3 className="font-semibold text-sm">How do single-story purchases work?</h3>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  When you purchase an individual story, all chapters of that title are unlocked on your account with no recurring fees.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-1">
                <h3 className="font-semibold text-sm">Are opening chapters free?</h3>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  Yes. Opening chapters (Chapters 1 to 3 on most series) are free to read before unlocking remaining chapters.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
