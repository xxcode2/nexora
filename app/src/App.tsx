import { FC, useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { NexoraProvider, useNexora, Market } from './contexts/NexoraContext';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import MarketsPage from './components/MarketsPage';
import Dashboard from './components/Dashboard';
import CreatePage from './components/CreatePage';
import PlaceBetModal from './components/PlaceBetModal';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

const AppContent: FC = () => {
  const { publicKey } = useWallet();
  const { fetchMarkets } = useNexora();

  const [currentPage, setCurrentPage] = useState('home');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const marketsData = await fetchMarkets();
      setMarkets(marketsData);
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

  const handleMarketCreated = () => {
    loadData();
    setCurrentPage('markets');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05050f] via-[#0a0a1a] to-[#05050f]">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />

      {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
      {currentPage === 'markets' && (
        <MarketsPage markets={markets} loading={loading} onBetClick={handleBetClick} />
      )}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'create' && <CreatePage onMarketCreated={handleMarketCreated} />}

      {/* Bet Modal */}
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

const App: FC = () => {
  // Use devnet
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Initialize wallets
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <NexoraProvider>
            <AppContent />
          </NexoraProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
