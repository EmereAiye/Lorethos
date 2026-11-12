import React from 'react';
import { useApp } from '../context/AppContext';
import { Check, ShieldCheck, Zap, BookOpen, Star, HelpCircle, ArrowRight } from 'lucide-react';

export const PricingView: React.FC = () => {
  const { openPaystackCheckout, user, navigate, stories } = useApp();
  const isPatron = user.subscription.status === 'active';

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-16 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
            Sustain Original Literature & Serialized Art
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
            Membership & Pricing
          </h1>
          <p className="font-reader text-base sm:text-lg text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
            Choose how you read. Enjoy complimentary opening chapters on every story, subscribe for unrestricted access across the catalog, or purchase individual books for lifetime ownership.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Tier 1: Free Traveler */}
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col justify-between shadow-xs">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                  Curious Reader
                </span>
                <h3 className="font-display text-2xl font-bold mt-1">Free Traveler</h3>
                <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader mt-2">
                  Sample opening chapters across all serialized fantasy, mythos, and mystery novels without registration.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold">₦0</span>
                <span className="text-xs text-[#2D142C]/60 dark:text-white/60 ml-1">/ forever</span>
              </div>

              <div className="space-y-3 text-xs text-[#2D142C]/80 dark:text-white/80 font-sans-ui pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chapters 1–3 free on all stories</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Distraction-free Day/Sepia/Night themes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Font size & typographic customizations</span>
                </div>
                <div className="flex items-center gap-2.5 opacity-50">
                  <span className="w-4 text-center">&ndash;</span>
                  <span>Advance chapter releases</span>
                </div>
                <div className="flex items-center gap-2.5 opacity-50">
                  <span className="w-4 text-center">&ndash;</span>
                  <span>Ambient audio soundscapes</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => navigate('stories')}
                className="w-full py-3 px-4 rounded-lg border border-[#2D142C]/20 dark:border-white/20 text-xs font-semibold hover:border-[#C85A32] hover:text-[#C85A32] transition-colors cursor-pointer"
              >
                Browse Free Chapters
              </button>
            </div>
          </div>

          {/* Tier 2: Patron Monthly (Featured / Highlighted) */}
          <div className="p-8 rounded-2xl bg-[#2D142C] text-[#F9F6F0] border-2 border-[#C85A32] flex flex-col justify-between shadow-2xl relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C85A32] text-white text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm font-sans-ui">
              Most Popular Patron Circle
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                  Unlimited Access
                </span>
                <h3 className="font-display text-2xl font-bold text-white mt-1">
                  Patron Monthly
                </h3>
                <p className="text-xs text-white/70 font-reader mt-2">
                  Full reading rights to the entire literary library, current releases, and advance chapter drops.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold text-white tabular-nums">₦3,500</span>
                <span className="text-xs text-white/60 ml-1">/ month</span>
              </div>

              <div className="space-y-3 text-xs text-white/90 font-sans-ui pt-2 border-t border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Unrestricted access to all chapters & books</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Advance chapter releases (14 days early)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Ambient hearth & rain audio soundscapes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Patron discussion & voting on story arcs</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <span>Cancel anytime in one click</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => openPaystackCheckout({
                  type: 'subscription',
                  title: 'Patron Monthly Subscription',
                  amountNgn: 3500,
                  planId: 'monthly'
                })}
                className="w-full py-3.5 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <span>{isPatron ? 'Renew Patron Membership' : 'Subscribe via Paystack (₦3,500)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tier 3: Patron Annual / Patron Patronage */}
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col justify-between shadow-xs">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                  Save 24% & Exclusive Perks
                </span>
                <h3 className="font-display text-2xl font-bold mt-1">Patron Annual</h3>
                <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader mt-2">
                  For devoted bibliophiles who wish to champion independent literature with an entire year of patron perks.
                </p>
              </div>

              <div className="pt-2">
                <span className="font-sans-ui text-4xl font-bold tabular-nums">₦32,000</span>
                <span className="text-xs text-[#2D142C]/60 dark:text-white/60 ml-1">/ year</span>
                <div className="text-[11px] text-[#C85A32] font-semibold mt-0.5">
                  Equivalent to ₦2,666 / mo (Save ₦10,000)
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#2D142C]/80 dark:text-white/80 font-sans-ui pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Everything in Monthly Membership</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Digital Omnibus downloads (EPUB / PDF)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Patron name inscribed in novel acknowledgments</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Direct author virtual salons & Q&A</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                onClick={() => openPaystackCheckout({
                  type: 'subscription',
                  title: 'Patron Annual Subscription (12 Months)',
                  amountNgn: 32000,
                  planId: 'annual'
                })}
                className="w-full py-3 px-4 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Join Annual Circle (₦32,000)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Section: Single Story & Book Purchases Alternative */}
        <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-wider uppercase text-[#C85A32] font-sans-ui">
                A La Carte Option
              </div>
              <h3 className="font-display text-2xl font-bold mt-1">
                Prefer Single-Story Purchases?
              </h3>
              <p className="font-reader text-xs sm:text-sm text-[#2D142C]/70 dark:text-white/70 mt-1 max-w-xl">
                Readers who do not desire a monthly commitment can unlock any specific book or standalone omnibus permanently.
              </p>
            </div>
            <button
              onClick={() => navigate('stories')}
              className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer self-start sm:self-auto shrink-0"
            >
              Browse Stories with Buy Options &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {stories.map(s => (
              <div
                key={s.id}
                className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h4 className="font-display text-sm font-bold truncate">{s.title}</h4>
                  <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                    ₦{s.priceNgn.toLocaleString('en-NG')} one-time
                  </div>
                </div>
                <button
                  onClick={() => openPaystackCheckout({
                    type: 'book_purchase',
                    title: `Book Unlock: ${s.title}`,
                    amountNgn: s.priceNgn,
                    storyId: s.id
                  })}
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
              <span>Nigerian Payment Architecture</span>
            </div>
            <h3 className="font-display text-2xl font-bold">
              Pay Effortlessly via Paystack
            </h3>
            <p className="font-reader text-xs sm:text-sm text-[#2D142C]/75 dark:text-white/75 leading-relaxed">
              We understand that convenience and trust matter. Lorethos processes all transactions in Nigerian Naira (₦) through Paystack, ensuring that:
            </p>
            <ul className="space-y-2 text-xs font-sans-ui text-[#2D142C]/80 dark:text-white/80">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>You can pay with local debit cards (Mastercard, Visa, and Verve).</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Direct instant bank transfers to a dynamic Paystack virtual account.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Quick USSD dial codes (*737#, *966#, *901#, *894#) with no internet banking needed.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                <span>Immediate chapter unlock receipt upon transaction completion.</span>
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
                <h4 className="font-semibold text-sm">Can I cancel my Patron subscription anytime?</h4>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  Yes, with a single click from your Reader Account dashboard. Your access will remain active until the end of your billing cycle.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-1">
                <h4 className="font-semibold text-sm">How do single-story purchases work?</h4>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  When you purchase a book, that title is permanently deposited into your personal Vault. You will never be billed recurring fees for that story.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-1">
                <h4 className="font-semibold text-sm">Are opening chapters really 100% free?</h4>
                <p className="text-[#2D142C]/70 dark:text-white/70 font-reader">
                  Yes. Every serialized title on Lorethos offers Chapters 1 to 3 completely free with full reader features so you can get hooked before deciding to unlock.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
