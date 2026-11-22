import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const { currentRoute, navigate, buildHref, user, isAuthenticated } = useApp();

  if (currentRoute === 'reader') {
    return null;
  }

  const isOwner = isAuthenticated && user.role === 'owner';

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
  };

  return (
    <footer className="bg-[#2D142C] text-[#F9F6F0] pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-white/10">

          {/* Column 1: Brand & Overview */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/1A2959EF-E3CD-42F2-B9E5-21E771900F65_0f8daa7f.png"
                alt="Lorethos Logo"
                className="w-10 h-10 object-contain rounded-full border border-[#C85A32]/60"
              />
              <span className="font-display text-xl tracking-[0.2em] font-bold text-[#F9F6F0] uppercase">
                LORETHOS
              </span>
            </div>
            <p className="text-xs text-[#F9F6F0]/70 leading-relaxed font-reader">
              An original digital storytelling platform built for comfortable long-form reading and serialized chapter releases.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#C85A32] font-medium pt-1">
              <span>Beyond world, within worlds.</span>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4 font-sans-ui">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm text-[#F9F6F0]/80">
              <li>
                <a
                  href={buildHref('stories')}
                  onClick={(e) => handleLink(e, 'stories')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Story Library
                </a>
              </li>
              <li>
                <a
                  href={buildHref('leaderboard')}
                  onClick={(e) => handleLink(e, 'leaderboard')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Reading Leaderboard
                </a>
              </li>
              <li>
                <a
                  href={buildHref('pricing')}
                  onClick={(e) => handleLink(e, 'pricing')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Membership &amp; Pricing
                </a>
              </li>
              <li>
                <a
                  href={buildHref('studio')}
                  onClick={(e) => handleLink(e, 'studio')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Words to Video Studio
                </a>
              </li>
              <li>
                <a
                  href={buildHref('profile')}
                  onClick={(e) => handleLink(e, 'profile')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Reader Profile &amp; Photo
                </a>
              </li>
              <li>
                <a
                  href={buildHref('account')}
                  onClick={(e) => handleLink(e, 'account')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Reader Account &amp; Library
                </a>
              </li>
              {isOwner && (
                <li>
                  <a
                    href={buildHref('admin')}
                    onClick={(e) => handleLink(e, 'admin')}
                    className="hover:text-[#C85A32] transition-colors"
                  >
                    Publishing Desk
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Support & Contact */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4 font-sans-ui">
              Support &amp; Contact
            </h4>
            <ul className="space-y-2.5 text-sm text-[#F9F6F0]/80">
              <li>
                <a
                  href={buildHref('contact')}
                  onClick={(e) => handleLink(e, 'contact')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Editorial &amp; Reader Inquiries
                </a>
              </li>
              <li>
                <a
                  href={buildHref('contact')}
                  onClick={(e) => handleLink(e, 'contact')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Submit Feedback or Questions
                </a>
              </li>
              <li>
                <a
                  href={buildHref('stories')}
                  onClick={(e) => handleLink(e, 'stories')}
                  className="hover:text-[#C85A32] transition-colors"
                >
                  Browse Free Opening Chapters
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Payment Methods */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4 font-sans-ui">
              Payment methods
            </h4>
            <div className="p-3.5 rounded bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-white/90">
                <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
                <span>Paystack Hosted Checkout</span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Supports Naira payments via debit cards, bank transfers, and USSD through Paystack hosted checkout pages.
              </p>
            </div>
            <p className="text-[11px] text-white/50">
              Nigeria &middot; Global Literary Network
            </p>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50 font-sans-ui">
          <p>&copy; {new Date().getFullYear()} Lorethos Publishing. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span>Crafted for literary immersion</span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              Serialized with <Heart className="w-3 h-3 text-[#C85A32] fill-[#C85A32]" /> for readers
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
