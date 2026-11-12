import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PaystackModal } from './components/PaystackModal';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { StoryOverviewView } from './views/StoryOverviewView';
import { ReaderView } from './views/ReaderView';
import { PricingView } from './views/PricingView';
import { AccountView } from './views/AccountView';
import { ContactView } from './views/ContactView';
import { AdminView } from './views/AdminView';

const MainContent: React.FC = () => {
  const { currentRoute, readerSettings, activeProgress, navigate } = useApp();

  const renderCurrentView = () => {
    switch (currentRoute) {
      case 'home':
        return <HomeView />;
      case 'stories':
        return <LibraryView />;
      case 'story-detail':
        return <StoryOverviewView />;
      case 'reader':
        return <ReaderView />;
      case 'pricing':
        return <PricingView />;
      case 'account':
        return <AccountView />;
      case 'contact':
        return <ContactView />;
      case 'admin':
        return <AdminView />;
      default:
        return <HomeView />;
    }
  };

  const themeClasses = {
    day: 'bg-[#F9F6F0] text-[#2D142C]',
    sepia: 'bg-[#F4ECE1] text-[#2C1E18]',
    night: 'bg-[#160C16] text-[#F9F6F0]'
  }[readerSettings.theme];

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-200 ${themeClasses}`}>
      <Navbar />
      <main className="flex-1">
        {renderCurrentView()}
      </main>
      <Footer />
      <PaystackModal />

      {/* Global Floating Reading Progress Dock (when outside reader) */}
      {currentRoute !== 'reader' && activeProgress && (
        <aside 
          aria-label="Reading progress quick dock"
          className="fixed bottom-5 left-5 z-40 hidden md:flex items-center gap-3 p-2.5 pr-4 rounded-xl shadow-2xl border border-[#C85A32]/40 bg-white/95 dark:bg-[#1E111E]/95 sepia:bg-[#EDE3D5]/95 backdrop-blur-md text-xs font-sans-ui animate-in slide-in-from-bottom-2"
        >
          <img
            src={activeProgress.story.coverImage}
            alt=""
            className="w-8 h-11 object-cover rounded shadow-2xs border border-current/10"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-[10px] text-[#C85A32] font-bold uppercase tracking-wider">
              <span>Reading Progress</span>
              <span>&middot;</span>
              <span className="font-mono">{activeProgress.progressPercent}%</span>
            </div>
            <span className="font-display text-sm font-bold truncate max-w-[170px] text-current">
              {activeProgress.story.title}
            </span>
            <span className="text-[11px] opacity-70">
              Chapter {activeProgress.chapterNumber} &middot; {activeProgress.lastReadAt}
            </span>
            <div className="w-36 bg-current/15 h-1 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-[#C85A32] h-full rounded-full transition-all"
                style={{ width: `${activeProgress.progressPercent}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => navigate('reader', { slug: activeProgress.story.slug, chapterNumber: activeProgress.chapterNumber })}
            className="ml-2 px-3 py-1.5 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
          >
            Resume &rarr;
          </button>
        </aside>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
