import { FC } from 'react';
import { BN } from '@coral-xyz/anchor';
import { Market } from '../contexts/NexoraContext';

interface MarketCardProps {
  market: Market;
  onBetClick?: () => void;
}

const MarketCard: FC<MarketCardProps> = ({ market, onBetClick }) => {
  const totalPool = (market.totalPool as BN).toNumber() / 1e6;

  // For V1, we don't have yes/no pool split data
  // These are placeholder values for UI demonstration
  const yesPct = 60; // TODO: Calculate from actual bet data
  const noPct = 40;

  const now = Date.now() / 1000;
  const expiryTimestamp = (market.expiryTimestamp as BN).toNumber();
  const timeLeft = expiryTimestamp - now;
  const isOpen = timeLeft > 0 && !market.resolved;

  const formatTimeLeft = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusBadge = () => {
    if (market.resolved) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25">
          Resolved
        </span>
      );
    }
    if (isOpen) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-300 border border-green-500/25">
          Open
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-300 border border-yellow-500/25">
        Closed
      </span>
    );
  };

  return (
    <div
      onClick={onBetClick}
      className="bg-gradient-to-br from-purple-500/10 to-transparent backdrop-blur-sm rounded-2xl p-6 border border-purple-500/12 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/8 transition-all duration-400 cursor-pointer transform hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold leading-snug text-gray-100">{market.question}</h3>
        {getStatusBadge()}
      </div>

      {/* Time Left */}
      <div className="flex items-center gap-2 mb-4 text-xs font-mono text-slate-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        {formatTimeLeft(timeLeft)}
      </div>

      {/* Pool Distribution Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-medium mb-1.5">
          <span className="text-green-400">YES {yesPct}%</span>
          <span className="text-red-400">NO {noPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden bg-slate-800/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 shadow-sm shadow-green-500/30 transition-all duration-700"
            style={{ width: `${yesPct}%` }}
          />
        </div>
      </div>

      {/* Pool Value & Participants */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Pool Value</div>
          <div className="text-base font-bold text-gray-100">${totalPool.toFixed(2)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.4)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs text-slate-400">Encrypted bets</span>
        </div>
      </div>
    </div>
  );
};

export default MarketCard;
