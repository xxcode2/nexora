import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navbar: FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'markets', label: 'Markets' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'create', label: 'Create' },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#05050f]/85 border-b border-purple-500/8">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-wider bg-gradient-to-br from-gray-100 to-purple-200 bg-clip-text text-transparent">
              NEXORA
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`text-sm font-medium tracking-wide transition-all relative ${
                  currentPage === link.id
                    ? 'text-gray-100'
                    : 'text-slate-400 hover:text-gray-200'
                }`}
              >
                {link.label}
                {currentPage === link.id && (
                  <span className="absolute -bottom-[25px] left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-3">
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600 !rounded-xl !text-sm !font-semibold !px-4 !py-2 !transition-all hover:!shadow-lg hover:!shadow-purple-500/25" />
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="md:hidden flex items-center gap-4 pb-3 overflow-x-auto">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`text-sm font-medium tracking-wide whitespace-nowrap px-3 py-1.5 rounded-lg transition-all ${
                currentPage === link.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-gray-200'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
