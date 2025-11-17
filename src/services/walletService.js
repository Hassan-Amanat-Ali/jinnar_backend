import Wallet from "../models/Wallet.js";

export const WalletService = {
  
  async addDeposit(userId, amount, reference) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });

    wallet.balance += amount;

    wallet.transactions.push({
      type: "deposit",
      amount,
      status: "completed",
      description: "PawaPay deposit",
      flutterwaveTxRef: reference
    });

    await wallet.save();
    return wallet;
  },

  async addWithdrawal(userId, amount, reference) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });

    wallet.balance -= amount;

    wallet.transactions.push({
      type: "withdrawal",
      amount,
      status: "completed",
      description: "PawaPay withdrawal",
      flutterwaveTxRef: reference
    });

    await wallet.save();
    return wallet;
  }
};
