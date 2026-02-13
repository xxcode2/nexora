import { FC, useState } from 'react';
import { BN } from '@coral-xyz/anchor';
import { Market, useNexora } from '../contexts/NexoraContext';

interface PlaceBetModalProps {
  market: Market;
  onClose: () => void;
  onSuccess: () => void;
}

const PlaceBetModal: FC<PlaceBetModalProps> = ({ market, onClose, onSuccess }) => {
  const { placeBet } = useNexora();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('1');
  const [betting, setBetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Convert to micro USDC (6 decimals)
    const amountMicro = Math.floor(amountNum * 1e6);

    setBetting(true);
    try {
      const tx = await placeBet(market.publicKey, side, new BN(amountMicro));
      console.log('Bet placed:', tx);
      alert(`Bet placed successfully!
Side: ${side.toUpperCase()}
Amount: $${amountNum.toFixed(2)}
Tx: ${tx.slice(0, 8)}...

Your bet is now encrypted and confidential! 🔒`);
      onSuccess();
    } catch (error: any) {
      console.error('Error placing bet:', error);
      alert('Error placing bet: ' + error.message);
    } finally {
      setBetting(false);
    }
  };

  const totalPoolUSDC = (market.totalPool as BN).toNumber() / 1e6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-md rounded-2xl p-8 border border-purple-500/30 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-purple-200 mb-2">Place Confidential Bet</h2>
        <p className="text-purple-300/60 text-sm mb-6 line-clamp-2">{market.question}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Market Info */}
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-purple-300/60">Current Pool:</span>
                <span className="text-purple-300 font-semibold">${totalPoolUSDC.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300/60">Expires:</span>
                <span className="text-purple-300">
                  {new Date((market.expiryTimestamp as BN).toNumber() * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Side Selection */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-3">
              Choose Your Side
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide('yes')}
                className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                  side === 'yes'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-2 border-green-400'
                    : 'bg-green-500/20 border border-green-500/40 hover:bg-green-500/30'
                }`}
              >
                <div className="text-2xl mb-1">✅</div>
                <div>YES</div>
              </button>
              <button
                type="button"
                onClick={() => setSide('no')}
                className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                  side === 'no'
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 border-2 border-red-400'
                    : 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30'
                }`}
              >
                <div className="text-2xl mb-1">❌</div>
                <div>NO</div>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Bet Amount (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300 text-lg">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0.01"
                className="w-full pl-8 pr-4 py-3 bg-purple-950/30 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-500/60 text-lg"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[1, 5, 10, 25].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-3 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg transition-all"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-sm text-blue-300 space-y-2">
              <div className="font-semibold mb-2">🔒 Privacy Guarantees:</div>
              <div className="text-xs space-y-1 text-blue-300/80">
                <div>✓ Your bet side is encrypted and hidden</div>
                <div>✓ Powered by Arcium confidential computing</div>
                <div>✓ Only you can see your payout after resolution</div>
                <div>✓ Total pool remains public</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={betting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {betting ? 'Placing Bet...' : `Bet $${parseFloat(amount).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlaceBetModal;
