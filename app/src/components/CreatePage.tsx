import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ADMIN_PUBKEY } from '../contexts/NexoraContext';
import CreateMarketModal from './CreateMarketModal';

interface CreatePageProps {
  onMarketCreated: () => void;
}

const CreatePage: FC<CreatePageProps> = ({ onMarketCreated }) => {
  const { publicKey } = useWallet();
  const isAdmin = publicKey?.equals(ADMIN_PUBKEY) ?? false;
  const [showModal, setShowModal] = useState(false);

  const handleSuccess = () => {
    setShowModal(false);
    onMarketCreated();
  };

  if (!publicKey) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/10 rounded-full flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(168, 85, 247)"
              strokeWidth="2"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-purple-300 mb-2">Wallet Not Connected</h3>
          <p className="text-slate-400">Please connect your wallet to create a market</p>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/10 rounded-full flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(251, 191, 36)"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <circle cx="12" cy="16" r="1" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-yellow-300 mb-2">Admin Only</h3>
          <p className="text-slate-400">Only the admin wallet can create markets on Devnet V1</p>
          <p className="text-xs text-slate-500 mt-2 font-mono">
            Admin: {ADMIN_PUBKEY.toString().slice(0, 8)}...{ADMIN_PUBKEY.toString().slice(-8)}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 text-gray-100">Create Market</h2>
        <p className="text-sm text-slate-400">Launch a new encrypted prediction market</p>
      </div>

      {/* Create Market Button */}
      <div className="bg-gradient-to-br from-purple-500/10 to-transparent backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center transform hover:scale-105 transition-transform">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-gray-100 mb-3">Create New Market</h3>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Launch a privacy-preserving prediction market where bets are encrypted using Arcium's
            confidential computing
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            Create Encrypted Market
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
          <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 text-center">
            <div className="text-purple-400 font-semibold mb-1">🔒 Private</div>
            <div className="text-xs text-slate-400">Individual bets remain confidential</div>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
            <div className="text-blue-400 font-semibold mb-1">🔗 Onchain</div>
            <div className="text-xs text-slate-400">Powered by Solana blockchain</div>
          </div>
          <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
            <div className="text-green-400 font-semibold mb-1">🛡️ Secure</div>
            <div className="text-xs text-slate-400">Arcium MXE encryption</div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && <CreateMarketModal onClose={() => setShowModal(false)} onSuccess={handleSuccess} />}
    </section>
  );
};

export default CreatePage;
