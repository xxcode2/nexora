import { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BN } from '@coral-xyz/anchor';
import { useNexora, Market, UserPosition, ADMIN_PUBKEY } from '../contexts/NexoraContext';
import MarketCard from './MarketCard';
import CreateMarketModal from './CreateMarketModal';
import PlaceBetModal from './PlaceBetModal';

const Dashboard: FC = () => {
  const { publicKey } = useWallet();
  const { fetchMarkets, fetchUserPositions } = useNexora();

  // Check if connected wallet is admin
  const isAdmin = publicKey?.equals(ADMIN_PUBKEY) ?? false;

  const [markets, setMarkets] = useState<Market[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const marketsData = await fetchMarkets();
      setMarkets(marketsData);

      if (publicKey) {
        const positions = await fetchUserPositions(publicKey);
        setUserPositions(positions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleBetClick = (market: Market) => {
    setSelectedMarket(market);
    setShowBetModal(true);
  };

  const handleBetSuccess = () => {
    setShowBetModal(false);
    loadData();
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a14] via-[#1a1a2e] to-[#0a0a14]">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-purple-500/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-2xl animate-float">
                N
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  NEXORA
                </h1>
                <p className="text-sm text-purple-300/60">Private Prediction Markets</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
                <span className="text-purple-300/60">Network:</span>
                <span className="ml-2 text-purple-300 font-semibold">Devnet</span>
              </div>
              <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 hover:!from-purple-600 hover:!to-blue-600" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 py-12">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-purple-500/10 to-transparent backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-purple-300/60 text-sm mb-2">Total Markets</div>
            <div className="text-4xl font-bold text-purple-300">{markets.length}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-transparent backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20">
            <div className="text-blue-300/60 text-sm mb-2">Your Positions</div>
            <div className="text-4xl font-bold text-blue-300">{userPositions.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-transparent backdrop-blur-sm rounded-2xl p-6 border border-green-500/20">
            <div className="text-green-300/60 text-sm mb-2">Total Volume</div>
            <div className="text-4xl font-bold text-green-300">
              ${markets.reduce((sum, m) => sum + (m.totalPool as BN).toNumber() / 1e6, 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-purple-300">Active Markets</h2>
          {publicKey && isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-xl font-semibold transition-all transform hover:scale-105"
            >
              + Create Market (Admin)
            </button>
          )}
        </div>

        {/* Markets Grid */}
        {loading && markets.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500/20 border-t-purple-500"></div>
            <p className="mt-4 text-purple-300/60">Loading markets...</p>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">No markets yet</h3>
            <p className="text-purple-300/60">Be the first to create a prediction market!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard
                key={market.publicKey.toString()}
                market={market}
                userPosition={userPositions.find(
                  (p) => p.market.toString() === market.publicKey.toString()
                )}
                onBetClick={() => handleBetClick(market)}
                onUpdate={loadData}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateMarketModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showBetModal && selectedMarket && (
        <PlaceBetModal
          market={selectedMarket}
          onClose={() => setShowBetModal(false)}
          onSuccess={handleBetSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard;
