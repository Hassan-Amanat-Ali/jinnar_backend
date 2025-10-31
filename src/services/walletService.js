// services/walletService.js
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';

export const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0 });
    await wallet.save();
  }
  return wallet;
};

export const updateWalletBalance = async (
  userId,
  amount,
  txData = {}
) => {
  const wallet = await getOrCreateWallet(userId);

  wallet.balance += amount;
  wallet.transactions.push({
    type: txData.type || 'deposit',
    amount,
    status: 'completed',
    paymentMethod: txData.paymentMethod || 'flutterwave',
    flutterwaveTxRef: txData.flutterwaveTxRef,
    flutterwaveFlwRef: txData.flutterwaveFlwRef,
    description: txData.description || 'Wallet top-up',
    orderId: txData.orderId,
  });

  await wallet.save();
  return wallet;
};

export const deductWalletBalance = async (
  userId,
  amount,
  txData = {}
) => {
  const wallet = await getOrCreateWallet(userId);

  if (wallet.balance < amount) {
    throw new Error('Insufficient balance');
  }

  wallet.balance -= amount;
  wallet.transactions.push({
    type: txData.type || 'withdrawal',
    amount: -amount,
    status: txData.status || 'pending',
    paymentMethod: txData.paymentMethod || 'bank_transfer',
    flutterwaveTxRef: txData.flutterwaveTxRef,
    description: txData.description || 'Wallet withdrawal',
    orderId: txData.orderId,
  });

  await wallet.save();
  return wallet;
};

export const getWalletHistory = async (userId) => {
  const wallet = await Wallet.findOne({ userId })
    .select('balance transactions')
    .populate('transactions.orderId', 'title status');

  return wallet || { balance: 0, transactions: [] };
};