import React, { Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { Footer } from './components/Footer';
import { PaystackModal } from './components/PaystackModal';
import { ReadingPreferencesModal } from './components/ReadingPreferencesModal';
import { HomeView } from './views/HomeView';
import { lazyWithRetry, isChunkLoadError } from './utils/lazyWithRetry';
import { CheckCircle2, X, Loader2, RefreshCw } from 'lucide-react';

const LibraryView = lazyWithRetry(() => import('./views/LibraryView').then((m) => ({ default: m.LibraryView })));
const StoryOverviewView = lazyWithRetry(() => import('./views/StoryOverviewView').then((m) => ({ default: m.StoryOverviewView })));
const ReaderView = lazyWithRetry(() => import('./views/ReaderView').then((m) => ({ default: m.ReaderView })));
const PricingView = lazyWithRetry(() => import('./views/PricingView').then((m) => ({ default: m.PricingView })));
const AccountView = lazyWithRetry(() => import('./views/AccountView').then((m) => ({ default: m.AccountView })));
const ContactView = lazyWithRetry(() => import('./views/ContactView').then((m) => ({ default: m.ContactView })));
const VideoStudioView = lazyWithRetry(() => import('./views/VideoStudioView').then((m) => ({ default: m.VideoStudioView })));
const AdminView = lazyWithRetry(() => import('./views/AdminView').then((m) => ({ default: m.AdminView })));
const WriterStudioView = lazyWithRetry(() => import('./views/WriterStudioView').then((m) => ({ default: m.WriterStudioView })));
const ProfileView = lazyWithRetry(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })));

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string; isChunkError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isChunkError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const chunkErr = isChunkLoadError(error);
    return {
      hasError: true,
      isChunkError: chunkErr,
      message: chunkErr
        ? 'A newer version of Lorethos was published or your mobile connection dropped briefly while loading this view.'
        : error?.message || 'Unexpected rendering error.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lorethos UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] flex items-center justify-center p-6 font-sans-ui">
          <div className="max-w-md w-full rounded-2xl border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] p-6 space-y-4 shadow-lg">
            <h1 className="font-display text-2xl font-bold">
              {this.state.isChunkError ? 'View update required' : 'Unable to display this view'}
            </h1>
            <p className="text-xs leading-relaxed opacity-80">{this.state.message}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{this.state.isChunkError ? 'Load Latest Version' : 'Reload Page'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="px-4 py-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs font-semibold hover:bg-[#2D142C]/5 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainContent: React.FC = () => {
  const {
    currentRoute,
    readerSettings,
    activeProgress,
    navigate,
    buildHref,
    checkoutStatusMessage,
    clearCheckoutStatusMessage
  } = useApp();

  const [progressDockDismissed, setProgressDockDismissed] = React.useState(false);

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
      case 'studio':
        return <VideoStudioView />;
      case 'admin':
        return <AdminView />;
      case 'writer':
        return <WriterStudioView />;
      case 'profile':
        return <ProfileView />;
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
      <OfflineStatusIndicator />

      {checkoutStatusMessage && (
        <div
          role="status"
          className="bg-emerald-700 text-white px-4 py-2.5 text-xs font-sans-ui flex items-center justify-center gap-3"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{checkoutStatusMessage}</span>
          <button
            type="button"
            onClick={clearCheckoutStatusMessage}
            aria-label="Dismiss payment status message"
            className="p-0.5 hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs font-sans-ui opacity-70">
              <Loader2 className="w-6 h-6 animate-spin text-[#C85A32]" />
              <span>Loading view...</span>
            </div>
          }
        >
          {renderCurrentView()}
        </Suspense>
      </main>
      <Footer />
      <PaystackModal />
      <ReadingPreferencesModal />

      {/* Global Floating Reading Progress Dock (Desktop XL+ only so footer & mobile remain clear) */}
      {currentRoute !== 'reader' && activeProgress && !progressDockDismissed && (
        <aside
          aria-label="Reading progress quick dock"
          className="fixed bottom-5 left-5 z-40 hidden xl:flex items-center gap-3 p-2.5 pr-3 rounded-xl shadow-2xl border border-[#C85A32]/35 bg-white/95 dark:bg-[#1E111E]/95 sepia:bg-[#EDE3D5]/95 backdrop-blur-md text-xs font-sans-ui"
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
              <span className="font-mono tabular-nums">{activeProgress.progressPercent}%</span>
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
          <a
            href={buildHref('reader', {
              slug: activeProgress.story.slug,
              chapterNumber: activeProgress.chapterNumber
            })}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('reader', {
                slug: activeProgress.story.slug,
                chapterNumber: activeProgress.chapterNumber
              });
            }}
            className="ml-1 px-3 py-1.5 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs shrink-0"
          >
            Resume &rarr;
          </a>
          <button
            type="button"
            onClick={() => setProgressDockDismissed(true)}
            aria-label="Hide reading progress dock"
            title="Hide reading progress dock"
            className="p-1 rounded-md opacity-55 hover:opacity-100 hover:bg-current/10 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </AppErrorBoundary>
  );
}
