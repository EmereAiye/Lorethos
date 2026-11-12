import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, CreditCard, Landmark, Smartphone, Lock, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export const PaystackModal: React.FC = () => {
  const { paystackModal, closePaystackCheckout, completePaystackPayment, user } = useApp();
  const [activeChannel, setActiveChannel] = useState<'card' | 'bank_transfer' | 'ussd'>('card');
  const [cardNumber, setCardNumber] = useState('5399 4120 8891 4022');
  const [expiry, setExpiry] = useState('08/28');
  const [cvv, setCvv] = useState('381');
  const [selectedBank, setSelectedBank] = useState('GTBank (*737#)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  if (!paystackModal.isOpen || !paystackModal.data) {
    return null;
  }

  const { title, amountNgn, type } = paystackModal.data;

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentSuccess(true);
      setTimeout(() => {
        completePaystackPayment(activeChannel);
        setPaymentSuccess(false);
      }, 1400);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Paystack Header */}
        <div className="bg-[#092B42] text-white p-5 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase bg-[#0BA4DB]/30 text-[#0BA4DB] px-1.5 py-0.5 rounded">
                PAYSTACK CHECKOUT
              </span>
              <span className="text-xs text-slate-300">Lorethos Publishing</span>
            </div>
            <div className="text-xl font-bold font-sans-ui text-white">
              ₦{amountNgn.toLocaleString('en-NG')}.00
            </div>
            <div className="text-xs text-slate-300 truncate max-w-xs">
              {title} &middot; <span className="text-slate-400">{user.email}</span>
            </div>
          </div>
          <button
            onClick={closePaystackCheckout}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paymentSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Payment Confirmed!</h3>
            <p className="text-xs text-slate-600">
              Your {type === 'subscription' ? 'Patron Membership' : 'Book Unlock'} has been activated. Access has been granted across your account.
            </p>
            <div className="text-[11px] font-mono text-slate-400">
              Ref: pstk_ref_{Math.random().toString(36).slice(2, 9)} &middot; Instant NIBSS Settlement
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Channel Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mb-5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveChannel('card')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-md transition-all cursor-pointer ${
                  activeChannel === 'card'
                    ? 'bg-white text-[#092B42] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('bank_transfer')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-md transition-all cursor-pointer ${
                  activeChannel === 'bank_transfer'
                    ? 'bg-white text-[#092B42] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('ussd')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-md transition-all cursor-pointer ${
                  activeChannel === 'ussd'
                    ? 'bg-white text-[#092B42] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>USSD</span>
              </button>
            </div>

            {/* Card Channel */}
            {activeChannel === 'card' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="5399 0000 0000 0000"
                      className="w-full text-xs font-mono px-3 py-2.5 rounded border border-slate-300 focus:outline-none focus:border-[#0BA4DB] focus:ring-1 focus:ring-[#0BA4DB]"
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-1">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">Mastercard</span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded">Verve</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full text-xs font-mono px-3 py-2.5 rounded border border-slate-300 focus:outline-none focus:border-[#0BA4DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      placeholder="123"
                      className="w-full text-xs font-mono px-3 py-2.5 rounded border border-slate-300 focus:outline-none focus:border-[#0BA4DB]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Verified by 3D-Secure One-Time Password (OTP) via Nigerian Bank</span>
                </p>
              </div>
            )}

            {/* Bank Transfer Channel */}
            {activeChannel === 'bank_transfer' && (
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600">
                  Transfer exactly <strong className="text-slate-900 font-semibold">₦{amountNgn.toLocaleString('en-NG')}.00</strong> to the dedicated Paystack virtual account:
                </p>
                
                <div className="space-y-1.5 p-3 bg-white rounded border border-slate-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank Name</span>
                    <span className="font-semibold text-slate-800">Titan Paystack Bank</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Number</span>
                    <span className="font-mono font-bold text-base text-[#092B42]">9928 341 029</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beneficiary</span>
                    <span className="font-medium text-slate-700">Lorethos Publishing / Paystack</span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-700">
                  Account expires in 29:40 minutes. Payment verifies automatically within 10 seconds of transfer.
                </p>
              </div>
            )}

            {/* USSD Channel */}
            {activeChannel === 'ussd' && (
              <div className="space-y-3.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Your Nigerian Bank
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded border border-slate-300 bg-white focus:outline-none focus:border-[#0BA4DB]"
                >
                  <option value="GTBank (*737#)">Guaranty Trust Bank (*737#)</option>
                  <option value="Zenith (*966#)">Zenith Bank (*966#)</option>
                  <option value="Access (*901#)">Access Bank (*901#)</option>
                  <option value="FirstBank (*894#)">First Bank of Nigeria (*894#)</option>
                  <option value="UBA (*919#)">United Bank for Africa (*919#)</option>
                </select>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded text-center">
                  <p className="text-xs text-blue-900 font-medium mb-1">
                    Dial this shortcode on your registered SIM:
                  </p>
                  <p className="text-sm font-mono font-bold text-[#092B42] tracking-wider">
                    *737*2*{amountNgn}*99283#
                  </p>
                </div>
              </div>
            )}

            {/* Action CTA */}
            <div className="mt-5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-[#00C3F7] hover:bg-[#0BA4DB] text-[#092B42] font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#092B42]" />
                    <span>Processing with Paystack Nigeria...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {activeChannel === 'bank_transfer'
                        ? 'I Have Sent The ₦' + amountNgn.toLocaleString('en-NG')
                        : 'Pay ₦' + amountNgn.toLocaleString('en-NG') + '.00'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Paystack Trust Badge */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <Lock className="w-3 h-3" />
              <span>PCI-DSS Level 1 Certified &middot; AES-256 Bit Encryption</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
