import PawaPayController from './services/pawapayService.js';

PawaPayController.initialize();

async function runTests() {
  try {
    // Test createPayout
    console.log("Testing createPayout...");
    const payoutResult = await PawaPayController.createPayout({
      provider: "MTN_MOMO_ZMB",
      amount: 15,
      phoneNumber: "260763456789",
      withdrawId: "WID456789",
      country: "ZMB",
      currency: "ZMW",
    });
    console.log("Result:", payoutResult);

    // Test createDeposit
    console.log("\nTesting createDeposit...");
    const depositResult = await PawaPayController.createDeposit({
      provider: "MTN_MOMO_ZMB",
      amount: 1000,
      phoneNumber: "260763456789",
      orderId: "ORD123",
      country: "ZMB",
      currency: "ZMW",
    });
    console.log("Result:", depositResult);

    // Test checkTransactionStatus (use payoutId)
    if (payoutResult.success && payoutResult.payoutId) {
      console.log("\nTesting checkTransactionStatus (payout)...");
      const statusResult = await PawaPayController.checkTransactionStatus(payoutResult.payoutId, "payout");
      console.log("Result:", statusResult);
    }

    // Test createRefund (use depositId)
    if (depositResult.success && depositResult.depositId) {
      console.log("\nTesting createRefund...");
      const refundResult = await PawaPayController.createRefund(depositResult.depositId, 500, "Customer requested refund");
      console.log("Result:", refundResult);
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTests();