import { FC, useState } from 'react';
import { useNexora } from '../contexts/NexoraContext';

interface CreateMarketModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateMarketModal: FC<CreateMarketModalProps> = ({ onClose, onSuccess }) => {
  const { createMarket } = useNexora();
  const [question, setQuestion] = useState('');
  const [hours, setHours] = useState(24);
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || question.length > 280) {
      alert('Question must be between 1 and 280 characters');
      return;
    }

    if (hours < 1 || hours > 8760) {
      alert('Duration must be between 1 hour and 1 year');
      return;
    }

    setCreating(true);
    try {
      const expiryTimestamp = Math.floor(Date.now() / 1000) + hours * 3600;
      const tx = await createMarket(question, expiryTimestamp);
      console.log('Market created:', tx);
      alert(`Market created successfully!
Tx: ${tx.slice(0, 8)}...`);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating market:', error);
      alert('Error creating market: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-md rounded-2xl p-8 border border-purple-500/30 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-purple-200 mb-6">Create Prediction Market</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will Bitcoin reach $100k by end of 2026?"
              className="w-full px-4 py-3 bg-purple-950/30 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-500/60 resize-none"
              rows={3}
              maxLength={280}
            />
            <div className="text-xs text-purple-300/60 mt-1">
              {question.length}/280 characters
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Duration (hours)
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              min={1}
              max={8760}
              className="w-full px-4 py-3 bg-purple-950/30 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-500/60"
            />
            <div className="text-xs text-purple-300/60 mt-1">
              Expires: {new Date(Date.now() + hours * 3600000).toLocaleString()}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-sm text-blue-300 space-y-2">
              <div>📊 You will be the authority to resolve this market</div>
              <div>🔒 Individual bets remain confidential via Arcium</div>
              <div>💰 Total pool will be visible publicly</div>
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
              disabled={creating}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMarketModal;
