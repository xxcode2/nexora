import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { BN } from '@coral-xyz/anchor';
import { Market, UserPosition, useNexora } from '../contexts/NexoraContext';

interface MarketCardProps {
  market: Market;
  userPosition?: UserPosition;
  onBetClick: () => void;
  onUpdate: () => void;
}

const MarketCard: FC<MarketCardProps> = ({ market, userPosition, onBetClick, onUpdate }) => {
  const { publicKey } = useWallet();
  const { resolveMarket, claimPayout } = useNexora();
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const isAuthority = publicKey?.equals(market.authority);
  const expiryDate = new Date((market.expiryTimestamp as BN).toNumber() * 1000);
  const isExpired = Date.now() > expiryDate.getTime();
  const totalPoolUSDC = (market.totalPool as BN).toNumber() / 1e6;

  const getResultBadge = () => {
    if ('yes' in market.result) return '✅ YES';
    if ('no' in market.result) return '❌ NO';
    return '⏳ Pending';
  };

  const handleResolve = async (result: 'yes' | 'no') => {
    setResolving(true);
    try {
      const tx = await resolveMarket(market.publicKey, result);
      console.log('Market resolved:', tx);
      alert(`Market resolved as ${result.toUpperCase()}! 
Tx: ${tx.slice(0, 8)}...`);
      onUpdate();
    } catch (error: any) {
      console.error('Error resolving market:', error);
      alert('Error resolving market: ' + error.message);
    } finally {
      setResolving(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const tx = await claimPayout(market.publicKey);
      console.log('Claimed payout:', tx);
      alert(`Payout claimed!
Tx: ${tx.slice(0, 8)}...`);
      onUpdate();
    } catch (error: any) {
      console.error('Error claiming:', error);
      alert('Error claiming: ' + error.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all transform hover:scale-[1.02]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-purple-200 mb-2 line-clamp-2">
            {market.question}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-300/60">Pool:</span>
            <span className="text-purple-300 font-semibold">${totalPoolUSDC.toFixed(2)}</span>
          </div>
        </div>
        {market.resolved && (
          <div className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-mono">
            {getResultBadge()}
          </div>
        )}
      </div>

      {/* Expiry */}
      <div className="mb-4 text-sm">
        <span className="text-purple-300/60">Expires:</span>
        <span className={`ml-2 ${isExpired ? 'text-red-400' : 'text-purple-300'}`}>
          {expiryDate.toLocaleString()}
        </span>
        {isExpired && !market.resolved && (
          <span className="ml-2 text-red-400 text-xs">(Expired)</span>
        )}
      </div>

      {/* User Position */}
      {userPosition && (
        <div className="mb-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <div className="text-sm">
            <span className="text-purple-300/60">Your Position:</span>
            <span className="ml-2 text-purple-300 font-semibold">
              ${((userPosition.amount as BN).toNumber() / 1e6).toFixed(2)}
            </span>
          </div>
          {userPosition.claimed && (
            <div className="text-xs text-green-400 mt-1">✓ Claimed</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Bet Button */}
        {!market.resolved && !isExpired && publicKey && (
          <button
            onClick={onBetClick}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg font-semibold transition-all"
          >
            Place Bet
          </button>
        )}

        {/* Resolve Buttons (Authority Only) */}
        {isAuthority && isExpired && !market.resolved && (
          <>
            <button
              onClick={() => handleResolve('yes')}
              disabled={resolving}
              className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {resolving ? '...' : '✅ YES'}
            </button>
            <button
              onClick={() => handleResolve('no')}
              disabled={resolving}
              className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {resolving ? '...' : '❌ NO'}
            </button>
          </>
        )}

        {/* Claim Button */}
        {market.resolved && userPosition && !userPosition.claimed && publicKey && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : '💰 Claim Payout'}
          </button>
        )}

        {/* Already Claimed */}
        {market.resolved && userPosition?.claimed && (
          <div className="flex-1 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center text-purple-300/60 text-sm">
            ✓ Already Claimed
          </div>
        )}
      </div>

      {/* Authority Badge */}
      {isAuthority && (
        <div className="mt-3 text-xs text-purple-300/60 text-center">
          🔑 You own this market
        </div>
      )}
    </div>
  );
};

export default MarketCard;
