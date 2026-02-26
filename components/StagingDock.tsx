import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader, Trash2 } from 'lucide-react';
import { transactionQueue, Transaction, TransactionStatus, TransactionPriority } from '../services/transactionQueue';

export const StagingDock: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalFees, setTotalFees] = useState(0);
  const [isSigning, setIsSigning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadTransactions();
    const interval = setInterval(loadTransactions, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadTransactions = async () => {
    const txs = await transactionQueue.getAllTransactions();
    setTransactions(txs);
    const fees = await transactionQueue.getTotalEstimatedFees();
    setTotalFees(fees);
  };

  const handleAuthorizeAll = async () => {
    const pending = transactions.filter(tx => tx.status === TransactionStatus.PENDING);
    if (pending.length === 0) return;

    setIsSigning(true);
    setProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const tx = pending[i];
      try {
        const canExecute = await transactionQueue.canExecuteTransaction(tx.id);
        if (!canExecute) {
          await transactionQueue.updateTransactionStatus(tx.id, TransactionStatus.FAILED, 'Dependencies not met');
          continue;
        }

        await transactionQueue.updateTransactionStatus(tx.id, TransactionStatus.SIGNING);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await transactionQueue.updateTransactionStatus(tx.id, TransactionStatus.PROCESSING);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await transactionQueue.updateTransactionStatus(tx.id, TransactionStatus.CONFIRMED);
        setProgress({ current: i + 1, total: pending.length });
      } catch (error) {
        await transactionQueue.updateTransactionStatus(tx.id, TransactionStatus.FAILED, (error as Error).message);
      }
    }

    setIsSigning(false);
    await loadTransactions();
  };

  const handleRemove = async (id: string) => {
    await transactionQueue.removeTransaction(id);
    await loadTransactions();
  };

  const handleClearCompleted = async () => {
    await transactionQueue.clearCompleted();
    await loadTransactions();
  };

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.CONFIRMED: return <CheckCircle className="w-5 h-5 text-green-500" />;
      case TransactionStatus.FAILED: return <XCircle className="w-5 h-5 text-red-500" />;
      case TransactionStatus.SIGNING:
      case TransactionStatus.PROCESSING: return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPriorityLabel = (priority: TransactionPriority) => {
    const labels = ['Low', 'Medium', 'High', 'Critical'];
    const colors = ['text-gray-400', 'text-blue-400', 'text-orange-400', 'text-red-400'];
    return <span className={colors[priority]}>{labels[priority]}</span>;
  };

  const pendingCount = transactions.filter(tx => tx.status === TransactionStatus.PENDING).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Staging Dock</h1>
        <button onClick={handleClearCompleted} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
          Clear Completed
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-gray-400 text-sm">Pending Transactions</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Estimated Fees</p>
            <p className="text-2xl font-bold">{totalFees.toFixed(7)} XLM</p>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={handleAuthorizeAll}
            disabled={isSigning}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSigning ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Signing {progress.current}/{progress.total}
              </>
            ) : (
              `Authorize All (${pendingCount})`
            )}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {transactions.map(tx => (
          <div key={tx.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {getStatusIcon(tx.status)}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold">{tx.type}</span>
                  {getPriorityLabel(tx.priority)}
                </div>
                {tx.amount && <p className="text-sm text-gray-400">{tx.amount} {tx.asset || 'XLM'} → {tx.recipient?.slice(0, 8)}...</p>}
                <p className="text-xs text-gray-500">Fee: {tx.estimatedFee} XLM</p>
                {tx.error && <p className="text-xs text-red-400 mt-1">{tx.error}</p>}
              </div>
            </div>
            <button onClick={() => handleRemove(tx.id)} className="p-2 hover:bg-gray-700 rounded">
              <Trash2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No transactions in queue
        </div>
      )}
    </div>
  );
};
