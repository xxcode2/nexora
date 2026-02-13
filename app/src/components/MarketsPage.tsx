import { FC } from 'react';
import { Market } from '../contexts/NexoraContext';
import MarketCard from './MarketCard';

interface MarketsPageProps {
  markets: Market[];
  loading: boolean;
  onBetClick: (market: Market) => void;
}

const MarketsPage: FC<MarketsPageProps> = ({ markets, loading, onBetClick }) => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 text-gray-100">Prediction Markets</h2>
        <p className="text-sm text-slate-400">
          Browse open markets and place encrypted predictions
        </p>
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
          {markets.map((market, index) => (
            <div
              key={market.publicKey.toString()}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <MarketCard market={market} onBetClick={() => onBetClick(market)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MarketsPage;
