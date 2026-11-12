import React from 'react';
import { useApp } from '../context/AppContext';
import { Youtube, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const { currentRoute, navigate } = useApp();

  if (currentRoute === 'reader') {
    return null;
  }

  return (
    <footer className="bg-[#2D142C] text-[#F9F6F0] pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-white/10">
          
          {/* Column 1: Brand & Philosophy */}
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
              A dedicated digital storytelling and publishing sanctum built for long-form comfort, serialized chapter releases, and original mythic literature.
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
                <button
                  onClick={() => navigate('stories')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Story Library
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('pricing')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Patron Membership & Pricing
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('account')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Reader Account & Vault
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('admin')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Publishing Admin Desk
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Community & Multimedia */}
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4 font-sans-ui">
              Community & Lore
            </h4>
            <ul className="space-y-2.5 text-sm text-[#F9F6F0]/80">
              <li>
                <button
                  onClick={() => navigate('contact')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left flex items-center gap-2"
                >
                  <Youtube className="w-4 h-4 text-[#C85A32]" />
                  <span>Lorethos Chronicles on YouTube</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('contact')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Author & Editorial Inquiries
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('pricing')}
                  className="hover:text-[#C85A32] transition-colors cursor-pointer text-left"
                >
                  Audio Narration & V2 Upgrades
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Monetization Architecture */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-4 font-sans-ui">
              Payment Architecture
            </h4>
            <div className="p-3.5 rounded bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-white/90">
                <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
                <span>Powered by Paystack</span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Accepting Nigerian debit cards (Mastercard, Visa, Verve), Direct Bank Transfers, and USSD with bank-grade encryption.
              </p>
            </div>
            <p className="text-[11px] text-white/50">
              Nigeria &middot; Global Literary Network
            </p>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50 font-sans-ui">
          <p>© {new Date().getFullYear()} Lorethos Publishing. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span>Crafted for literary immersion</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              Serialized with <Heart className="w-3 h-3 text-[#C85A32] fill-[#C85A32]" /> for readers
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
