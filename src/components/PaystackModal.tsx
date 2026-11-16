import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Lock, Loader2, ArrowRight, AlertCircle, UserCheck } from 'lucide-react';

export const PaystackModal: React.FC = () => {
  const { paystackModal, closePaystackCheckout, user, isAuthenticated, navigate, buildHref } = useApp();
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setIsInitializing(false);
  }, [paystackModal.isOpen, paystackModal.data]);

  useEffect(() => {
    if (!paystackModal.isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isInitializing) {
        closePaystackCheckout();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paystackModal.isOpen, isInitializing, closePaystackCheckout]);

  if (!paystackModal.isOpen || !paystackModal.data) {
    return null;
  }

  const { title, amountNgn, type, planId, storyId } = paystackModal.data;

  const handleStartHostedCheckout = async () => {
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemType: type,
          planId,
          storyId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error ||
            'Unable to initialize Paystack checkout right now. Please try again later.'
        );
        return;
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      setErrorMessage('Server did not return a Paystack hosted checkout URL.');
    } catch {
      setErrorMessage('Network error while contacting the payment server.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={() => {
        if (!isInitializing) closePaystackCheckout();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paystack-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#092B42] text-white p-5 flex items-start justify-between">
          <div className="space-y-1 min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase bg-[#0BA4DB]/25 text-[#64D2FF] px-2 py-0.5 rounded">
                PAYSTACK HOSTED CHECKOUT
              </span>
            </div>
            <h2 id="paystack-modal-title" className="text-xl font-bold font-sans-ui text-white">
              ₦{amountNgn.toLocaleString('en-NG')}.00
            </h2>
            <div className="text-xs text-slate-300 truncate">
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={closePaystackCheckout}
            disabled={isInitializing}
            aria-label="Close checkout dialog"
            className="text-slate-300 hover:text-white p-1.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 font-sans-ui text-xs">
          {!isAuthenticated ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span>Sign in required before payment</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Your unlocked chapters and membership status are tied to your Lorethos account so access persists across devices.
                </p>
              </div>

              <a
                href={buildHref('account')}
                onClick={(e) => {
                  e.preventDefault();
                  closePaystackCheckout();
                  navigate('account');
                }}
                className="w-full py-3 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <span>Go to Sign In / Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Account Email</span>
                  <span className="font-semibold text-slate-900 truncate">{user.email}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Order Item</span>
                  <span className="font-medium text-slate-900 text-right">{title}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Authoritative Server Total</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ₦{amountNgn.toLocaleString('en-NG')}.00 NGN
                  </span>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Clicking below creates a pending server order and redirects you to Paystack&apos;s official hosted checkout page (supporting Nigerian cards, bank transfer, and USSD). Access is unlocked only after Paystack verifies settlement.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartHostedCheckout}
                disabled={isInitializing}
                className="w-full py-3 px-4 bg-[#00C3F7] hover:bg-[#0BA4DB] text-[#092B42] font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-60"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#092B42]" />
                    <span>Connecting to Paystack...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Paystack Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Lock className="w-3 h-3" />
                <span>Redirected over HTTPS directly to checkout.paystack.com</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
