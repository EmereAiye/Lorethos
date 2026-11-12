import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Mail, 
  Youtube, 
  MapPin, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  Play, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const ContactView: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    inquiryType: 'Reader Feedback & Lore',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-16 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
            Community & Editorial Desk
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            Connect with Lorethos
          </h1>
          <p className="font-reader text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
            Whether inquiring about serialized publication submissions, lore theories, or technical feedback, our editorial team welcomes your message.
          </p>
        </div>

        {/* 2-Column Split: Form + YouTube & Contact Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left: Enquiry Form */}
          <div className="lg:col-span-7 bg-white dark:bg-[#1E111E] p-8 rounded-2xl border border-[#2D142C]/10 dark:border-white/10 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold">Send an Editorial Dispatch</h2>
              <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-1">
                All communications receive a thoughtful reply within 2 business days.
              </p>
            </div>

            {submitted ? (
              <div className="p-8 text-center space-y-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="font-display text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  Dispatch Received
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-reader max-w-md mx-auto">
                  Thank you, {formData.name}. Your inquiry has been forwarded to the chief scribe at Lorethos Publishing. A reply will arrive at {formData.email}.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', inquiryType: 'Reader Feedback & Lore', subject: '', message: '' });
                  }}
                  className="text-xs font-semibold text-[#C85A32] underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans-ui">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Folake Adebayo"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. folake@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Inquiry Purpose</label>
                    <select
                      value={formData.inquiryType}
                      onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="Reader Feedback & Lore" className="bg-white dark:bg-[#1E111E]">Reader Feedback & Lore</option>
                      <option value="Manuscript Pitch / Publishing" className="bg-white dark:bg-[#1E111E]">Manuscript Pitch / Publishing</option>
                      <option value="Patron & Paystack Billing Support" className="bg-white dark:bg-[#1E111E]">Patron & Paystack Billing Support</option>
                      <option value="Media & Press Inquiry" className="bg-white dark:bg-[#1E111E]">Media & Press Inquiry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="e.g. Chapter 4 Mythology Question"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Your Message or Manuscript Synopsis</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Share your thoughts, questions, or literary proposals with our team..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmit Dispatch to Editorial</span>
                </button>
              </form>
            )}
          </div>

          {/* Right: YouTube Hub & Official Contacts */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* YouTube Community Card */}
            <div className="p-6 rounded-2xl bg-[#2D142C] text-[#F9F6F0] border border-white/10 shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <span className="text-xs font-bold tracking-wider uppercase text-[#C85A32]">
                  YouTube Official Channel
                </span>
              </div>
              
              <h3 className="font-display text-2xl font-bold text-white">
                Lorethos Chronicles on YouTube
              </h3>

              <p className="text-xs text-white/70 font-reader leading-relaxed">
                Watch serialized video readings, character lore analyses, map breakdowns, and author dialogues. New visual lore drops every Friday.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3 bg-white/5 rounded-lg flex items-center gap-3">
                  <Play className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-white">The Astral High Roads of the Baobab</div>
                    <div className="text-[10px] text-white/50">Episode 04 &middot; Lore Exploration</div>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-lg flex items-center gap-3">
                  <Play className="w-4 h-4 text-[#C85A32] shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-white">The Nine Dynasties of Ostraka</div>
                    <div className="text-[10px] text-white/50">Episode 03 &middot; World History</div>
                  </div>
                </div>
              </div>

              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Youtube className="w-4 h-4" />
                <span>Visit Channel & Subscribe (Free)</span>
              </a>
            </div>

            {/* Direct Contact Markers */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4">
              <h4 className="font-display text-lg font-bold">Publishing Desk Details</h4>
              <div className="space-y-3 text-xs font-sans-ui text-[#2D142C]/80 dark:text-white/80">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#2D142C] dark:text-white">Editorial Inquiries</strong>
                    <span>contact@lorethos.com</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[#2D142C] dark:text-white">Headquarters</strong>
                    <span>Nigeria &middot; Global Digital Bureau</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
