import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, MapPin, Send, CheckCircle2, BookOpen, ArrowRight } from 'lucide-react';

export const ContactView: React.FC = () => {
  const { submitInquiry, inquiries, navigate, buildHref } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    inquiryType: 'Reader Feedback',
    subject: '',
    message: '',
    website: '' // honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const receipt = await submitInquiry(formData);
      setSubmittedRef(receipt.referenceId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-16 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
            Support &amp; Editorial Contact
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            Contact Lorethos
          </h1>
          <p className="font-reader text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
            Reach out about story feedback, manuscript submissions, billing questions, or technical issues.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Contact Form */}
          <div className="lg:col-span-7 bg-white dark:bg-[#1E111E] p-8 rounded-2xl border border-[#2D142C]/10 dark:border-white/10 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold">Send a Message</h2>
              <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui mt-1">
                Submitted messages are saved for editorial and support review.
              </p>
            </div>

            {submittedRef ? (
              <div
                role="status"
                className="p-8 text-center space-y-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <div className="inline-block text-[11px] font-mono px-2.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 font-semibold">
                  Reference: {submittedRef}
                </div>
                <h3 className="font-display text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  Message saved
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-reader max-w-md mx-auto">
                  Thank you, {formData.name}. Your inquiry has been saved under reference {submittedRef}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRef(null);
                    setFormData({
                      name: '',
                      email: '',
                      inquiryType: 'Reader Feedback',
                      subject: '',
                      message: '',
                      website: ''
                    });
                  }}
                  className="text-xs font-semibold text-[#C85A32] underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans-ui">
                {/* Honeypot anti-spam field */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block font-semibold mb-1">
                      Your Full Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block font-semibold mb-1">
                      Email Address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-type" className="block font-semibold mb-1">
                      Topic
                    </label>
                    <select
                      id="contact-type"
                      value={formData.inquiryType}
                      onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="Reader Feedback" className="bg-white dark:bg-[#1E111E]">Reader Feedback</option>
                      <option value="Manuscript Submission" className="bg-white dark:bg-[#1E111E]">Manuscript Submission</option>
                      <option value="Billing & Paystack Support" className="bg-white dark:bg-[#1E111E]">Billing &amp; Paystack Support</option>
                      <option value="General Question" className="bg-white dark:bg-[#1E111E]">General Question</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block font-semibold mb-1">
                      Subject
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Subject line"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block font-semibold mb-1">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    required
                    minLength={10}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Write your message (at least 10 characters)..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader text-sm"
                  />
                </div>

                {submitError && (
                  <p role="alert" className="text-red-600 dark:text-red-400">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-60 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Sending...' : 'Send message'}</span>
                </button>
              </form>
            )}

            {inquiries.length > 0 && (
              <div className="pt-4 border-t border-[#2D142C]/10 dark:border-white/10 space-y-2.5 text-xs font-sans-ui">
                <span className="font-semibold text-[#2D142C]/70 dark:text-white/70 block">
                  Your Recent Messages ({inquiries.length})
                </span>
                <div className="space-y-2">
                  {inquiries.slice(0, 3).map(inq => (
                    <div
                      key={inq.id}
                      className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-[#C85A32] font-bold mr-2">
                          {inq.referenceId}
                        </span>
                        <span className="font-semibold truncate">{inq.subject}</span>
                      </div>
                      <span className="text-[11px] opacity-60 shrink-0">{inq.submittedAt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Direct Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4">
              <h2 className="font-display text-lg font-bold">Publishing Desk Details</h2>
              <div className="space-y-3 text-xs font-sans-ui text-[#2D142C]/80 dark:text-white/80">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#2D142C] dark:text-white">Editorial Email</strong>
                    <span>contact@lorethos.com</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#2D142C] dark:text-white">Publishing Operations</strong>
                    <span>Nigeria &middot; Global Digital Catalog</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#2D142C] text-[#F9F6F0] border border-white/10 shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C85A32]" />
                <span className="text-xs font-bold tracking-wider uppercase text-[#C85A32]">
                  Catalog Access
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-white">
                Looking for a Story to Read?
              </h3>
              <p className="text-xs text-white/75 font-reader leading-relaxed">
                Explore published stories and sample opening chapters free in the Lorethos reader.
              </p>
              <a
                href={buildHref('stories')}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate('stories');
                }}
                className="w-full py-2.5 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <span>Browse Story Library</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
