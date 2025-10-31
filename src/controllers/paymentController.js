// // controllers/paymentController.js
// import User from '../models/User.js';
// import JobRequest from '../models/JobRequest.js';
// import flw from '../config/flutterwave.js';

// // Generate unique tx_ref
// const generateTxRef = (userId) => `JINNAR-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;


// export const createPayment = async (req, res) => {
//   try {
//     const payload = {
//       tx_ref: "tx-" + Date.now(),
//       amount: "100",
//       currency: "NGN",  // Change to USD, GHS, KES, ZAR, etc.
//       redirect_url: "http://localhost:3000/payment/callback",
//       payment_options: "card,banktransfer,ussd,mpesa,mobilemoneyghana,paypal",
//       customer: {
//         email: "test@gmail.com",
//         phonenumber: "09000000000",
//         name: "Test User",
//       }
//     };
// console.log("dont be undefined ma bro : " +flw);
//     const response = await flw.Payment.initialize(payload);
//     return res.json(response); // response.data.link ← frontend opens this
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // ───────────────────────────────────────
// // 1. TOP-UP WALLET (All Flutterwave Methods)
// // ───────────────────────────────────────
// export const initializeTopup = async (req, res) => {
//   try {
//     const { id } = req.user;  // ✅ from Bearer Token Middleware
//     const { amount, paymentMethod, currency = "KES" } = req.body;

//     if (!amount || !paymentMethod) {
//       return res.status(400).json({ error: "Amount and paymentMethod are required" });
//     }

//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const tx_ref = `wallet-${id}-${Date.now()}`;

//     // Save a pending transaction in user's wallet
//    try {
//      user.wallet.transactions.push({
//       type: "wallet_topup",
//       amount,
//       status: "pending",
//       paymentMethod,
//       flutterwaveTxRef: tx_ref,
//     });
//     await user.save();

//    } catch (error) {
// console.error("Wallet Transaction Save Error:", error);    
//    }
//     // Payment payload for Flutterwave
//     const payload = {
//       tx_ref,
//       amount,
//       currency, 
//       redirect_url: "https://your-frontend.com/wallet/success",
//       customer: {
//         email: user.email,
//         name: user.name || user.username,
//         phonenumber: user.phone,
//       },
//       customizations: {
//         title: "Wallet Top-up",
//         description: "Adding funds to wallet",
//       },
//       enckey: process.env.FLW_ENCRYPTION_KEY
//     };

//     // Call correct payment API based on method
//     let response;
//     switch (paymentMethod) {
//       case "card":
//         response = await flw.Charge.card(payload);
//         break;
//       case "mpesa":
//         response = await flw.MobileMoney.mpesa(payload);
//         break;
//       case "mobilemoney_ghana":
//         response = await flw.MobileMoney.ghana(payload);
//         break;
//       case "bank_transfer":
//         response = await flw.Charge.bank_transfer(payload);
//         break;
//       case "ussd":
//         response = await flw.Charge.ussd(payload);
//         break;
//       default:
//         return res.status(400).json({ error: "Invalid payment method" });
//     }

//     return res.json({
//       success: true,
//       message: "Payment initiated",
//       paymentLink: response?.data?.link, // Flutterwave hosted link if card/ussd/bank_transfer
//       flwResponse: response,
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to initialize top-up", details: error.message });
//   }
// };

// // ───────────────────────────────────────
// // 2. DIRECT PAY FOR ORDER (No Wallet)
// // ───────────────────────────────────────
// export const payForOrder = async (req, res) => {
//   try {
//     const { id } = req.user;
//     const { jobRequestId, currency = 'KES' } = req.body;

//     const jobRequest = await JobRequest.findById(jobRequestId)
//       .populate('gigId', 'title pricing')
//       .populate('sellerId', 'name');

//     if (!jobRequest || jobRequest.buyerId.toString() !== id) {
//       return res.status(404).json({ error: 'Order not found' });
//     }

//     if (jobRequest.status !== 'pending') {
//       return res.status(400).json({ error: 'Order already processed' });
//     }

//     const total = jobRequest.totalPrice;
//     const tx_ref = generateTxRef(id);

//     const paymentData = {
//       tx_ref,
//       amount: total,
//       currency,
//       redirect_url: `${process.env.FRONTEND_URL}/order/success?order=${jobRequestId}`,
//       payment_options: 'card,mpesa,mobilemoney,ussd,banktransfer',
//       meta: { userId: id, jobRequestId, type: 'order_payment' },
//       customer: {
//         email: req.user.email || 'buyer@jinnar.com',
//         phone_number: req.user.mobileNumber,
//         name: req.user.name
//       },
//       customizations: {
//         title: `Pay for ${jobRequest.gigId.title}`,
//         description: `Service: ${jobRequest.description.substring(0, 50)}...`
//       }
//     };

//     const response = await flw.Transaction.initiate(paymentData);

//     if (response.status === 'success') {
//       jobRequest.paymentStatus = 'pending';
//       jobRequest.flutterwaveTxRef = tx_ref;
//       jobRequest.flutterwaveFlwRef = response.data.flw_ref;
//       await jobRequest.save();

//       return res.json({
//         message: 'Payment initiated',
//         paymentLink: response.data.link,
//         tx_ref,
//         orderId: jobRequestId
//       });
//     }

//     res.status(400).json({ error: 'Payment failed' });

//   } catch (error) {
//     console.error('Order Pay Error:', error);
//     res.status(500).json({ error: 'Payment failed' });
//   }
// };

// // ───────────────────────────────────────
// // 3. WITHDRAW TO M-PESA / AIRTEL / TIGO / BANK
// // ───────────────────────────────────────
// export const withdrawFunds = async (req, res) => {
//   try {
//     const { id } = req.user;
//     const { amount, method, accountNumber, bankCode } = req.body;

//     const user = await User.findById(id);
//     if (user.role !== 'seller') return res.status(403).json({ error: 'Only sellers can withdraw' });
//     if (user.wallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

//     const tx_ref = generateTxRef(id);

//     let transferData = {};

//     if (method === 'mpesa' || method === 'airtel_money' || method === 'tigo_pesa') {
//       transferData = {
//         account_bank: method === 'mpesa' ? 'MPESA' : method === 'airtel_money' ? 'AIRTEL' : 'TIGO',
//         account_number: accountNumber,
//         amount,
//         currency: 'KES',
//         narration: 'Jinnar Payout',
//         reference: tx_ref,
//         callback_url: `${process.env.BACKEND_URL}/api/webhook/flutterwave`,
//         debit_currency: 'KES'
//       };
//     } else if (method === 'bank_transfer') {
//       transferData = {
//         account_bank: bankCode,
//         account_number: accountNumber,
//         amount,
//         currency: 'KES',
//         narration: 'Jinnar Bank Payout',
//         reference: tx_ref
//       };
//     }

//     const response = await flw.Transfer.create(transferData);

//     if (response.status === 'success') {
//       user.wallet.balance -= amount;
//       user.wallet.transactions.push({
//         type: 'withdrawal',
//         amount: -amount,
//         paymentMethod: method,
//         status: 'pending',
//         flutterwaveTxRef: tx_ref,
//         flutterwaveFlwRef: response.data.id
//       });
//       await user.save();

//       return res.json({
//         message: 'Withdrawal initiated',
//         reference: tx_ref,
//         status: 'pending'
//       });
//     }

//     res.status(400).json({ error: 'Withdrawal failed' });

//   } catch (error) {
//     console.error('Withdraw Error:', error);
//     res.status(500).json({ error: 'Withdrawal failed' });
//   }
// };

// // ───────────────────────────────────────
// // 4. WALLET BALANCE & HISTORY
// // ───────────────────────────────────────
// export const getWallet = async (req, res) => {
//   const user = await User.findById(req.user.id).select('wallet');
//   res.json({
//     balance: user.wallet.balance,
//     transactions: user.wallet.transactions
//       .sort((a, b) => b.createdAt - a.createdAt)
//       .slice(0, 50)
//   });
// };