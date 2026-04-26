import { jest } from '@jest/globals';

// Mock Dependencies
const mockWallet = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
};

const mockFXService = {
  isSupported: jest.fn(),
  convertToUSD: jest.fn(),
  convertFromUSD: jest.fn(),
  getRate: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// ESM Mocking
jest.unstable_mockModule("../src/models/Wallet.js", () => ({
  default: mockWallet
}));

jest.unstable_mockModule("../src/services/fxService.js", () => ({
  default: mockFXService
}));

jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: mockLogger
}));

// Import components after mocking
const WalletController = (await import("../src/controllers/walletController.js"));
const FXService = (await import("../src/services/fxService.js")).default;

describe("Wallet Module - Functional Tests", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: "user123" },
      body: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("getWalletBalance", () => {
    it("should return balance if wallet exists", async () => {
      mockWallet.findOne.mockResolvedValue({ userId: "user123", balance: 100, transactions: [] });
      
      await WalletController.getWalletBalance(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        balance: 100
      }));
    });

    it("should create wallet if it does not exist", async () => {
      mockWallet.findOne.mockResolvedValue(null);
      mockWallet.create.mockResolvedValue({ userId: "user123", balance: 0 });
      
      await WalletController.getWalletBalance(req, res);
      
      expect(mockWallet.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ balance: 0 }));
    });
  });

  describe("deposit (FX Logic)", () => {
    it("should fail if currency is not supported", async () => {
      req.body = { amount: 1000, currency: "XYZ", country: "TZ" };
      mockFXService.isSupported.mockResolvedValue(false);

      await WalletController.deposit(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("Unsupported currency")
      }));
    });

    it("should correctly handle currency conversion for deposit", async () => {
      req.body = { amount: 2600, currency: "TZS", country: "TZ" };
      mockFXService.isSupported.mockResolvedValue(true);
      mockFXService.convertToUSD.mockResolvedValue({
        usdAmount: 1,
        localAmount: 2600,
        rate: 2600
      });
      // Mocking transaction findOne for deposit check
      mockWallet.findOne.mockResolvedValue({ userId: "user123", balance: 0 });

      // We need to mock the PawaPay service call inside the controller 
      // but for this modular test we are focusing on the FX integration layer.
      await WalletController.deposit(req, res);

      expect(mockFXService.convertToUSD).toHaveBeenCalledWith(2600, "TZS");
    });
  });

  describe("withdraw (FX Logic)", () => {
    it("should verify sufficient USD balance before conversion", async () => {
      req.body = { amount: 100, currency: "TZS" }; // amount here is USD for withdrawal
      mockWallet.findOne.mockResolvedValue({ userId: "user123", balance: 50 }); // Only 50 USD

      await WalletController.withdraw(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "Insufficient balance"
      }));
    });

    it("should convert USD to local amount for payout", async () => {
      req.body = { amount: 10, currency: "TZS", country: "TZ", mobileNumber: "+255123456" };
      mockWallet.findOne.mockResolvedValue({ userId: "user123", balance: 100 });
      mockFXService.isSupported.mockResolvedValue(true);
      mockFXService.convertFromUSD.mockResolvedValue({
        localAmount: 26000,
        usdAmount: 10,
        rate: 2600
      });

      await WalletController.withdraw(req, res);

      expect(mockFXService.convertFromUSD).toHaveBeenCalledWith(10, "TZS");
    });
  });
});
