import { FC } from 'react';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

const HomePage: FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />
        </svg>

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-glow"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center min-h-[calc(100vh-64px)] py-20">
        {/* Privacy Badge */}
        <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full flex items-center gap-2 mb-8 animate-fade-in-up">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(129, 140, 248)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs font-medium tracking-wider text-purple-300">
            CONFIDENTIAL COMPUTING · POWERED BY ARCIUM
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-none mb-6 animate-fade-in-up bg-gradient-to-br from-gray-100 via-purple-200 to-purple-400 bg-clip-text text-transparent"
          style={{ animationDelay: '0.1s' }}
        >
          NEXORA
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg sm:text-xl md:text-2xl font-medium mb-4 text-purple-300 max-w-2xl animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          Private Onchain Prediction Market Powered by Arcium
        </p>

        {/* Description */}
        <p
          className="text-sm sm:text-base mb-10 leading-relaxed text-slate-400 max-w-lg animate-fade-in-up"
          style={{ animationDelay: '0.3s' }}
        >
          Place encrypted YES/NO predictions into a shared liquidity pool. Your position stays
          private. Only results are revealed.
        </p>

        {/* Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4 animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <button
            onClick={() => onNavigate('markets')}
            className="px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            Explore Markets
          </button>
          <button
            onClick={() => onNavigate('create')}
            className="px-8 py-3.5 rounded-xl text-base font-semibold bg-transparent border border-purple-500/35 text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/60 transition-all"
          >
            Create Market
          </button>
        </div>

        {/* Stats */}
        <div
          className="mt-16 grid grid-cols-3 gap-8 sm:gap-16 animate-fade-in-up"
          style={{ animationDelay: '0.5s' }}
        >
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-100">$4.2M</div>
            <div className="text-xs mt-1 tracking-wider text-slate-400">TOTAL VOLUME</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-100">847</div>
            <div className="text-xs mt-1 tracking-wider text-slate-400">MARKETS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-100">100%</div>
            <div className="text-xs mt-1 tracking-wider text-slate-400">PRIVATE</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomePage;
