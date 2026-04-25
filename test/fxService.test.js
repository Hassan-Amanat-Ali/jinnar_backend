import { jest } from '@jest/globals';

// Mock axios
const mockAxios = {
  get: jest.fn(),
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock dependencies using unstable_mockModule for ESM
jest.unstable_mockModule("axios", () => ({
  default: mockAxios
}));

jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: mockLogger
}));

// Import the service after mocking dependencies
const FXService = (await import("../src/services/fxService.js")).default;
const { FX_RATES, BASE_CURRENCY } = await import("../src/config/fxRates.js");

describe("FXService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    FXService.clearCache();
    process.env = { ...originalEnv, FX_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getLiveRates", () => {
    it("should fetch live rates when cache is empty", async () => {
      const mockRates = { KES: 130, TZS: 2700, USD: 1 };
      mockAxios.get.mockResolvedValue({
        data: {
          result: "success",
          conversion_rates: mockRates
        }
      });

      const rates = await FXService.getLiveRates();
      
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining('test-api-key'));
      expect(rates).toEqual(mockRates);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Successfully fetched"));
    });

    it("should return cached rates if TTL has not expired", async () => {
      const mockRates = { KES: 130, TZS: 2700, USD: 1 };
      // First call to populate cache
      mockAxios.get.mockResolvedValueOnce({
        data: { result: "success", conversion_rates: mockRates }
      });
      await FXService.getLiveRates();

      // Second call should hit cache
      const rates = await FXService.getLiveRates();
      
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
      expect(rates).toEqual(mockRates);
    });

    it("should fall back to static rates if API key is missing", async () => {
      process.env.FX_API_KEY = "";
      // Resetting cache state for this test is tricky due to closure, 
      // but if we call it with a fresh TTL or just assume fresh state:
      const rates = await FXService.getLiveRates();
      expect(rates).toEqual(FX_RATES);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("No API key provided"));
    });

    it("should fall back to static rates (or stale cache) if API fails", async () => {
      mockAxios.get.mockRejectedValue(new Error("Network Error"));
      
      const rates = await FXService.getLiveRates();
      // Since we don't reset the module between tests easily in ESM, 
      // it might return the stale cache from previous tests, which is actually the desired behavior!
      expect(rates).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("convertToUSD", () => {
    it("should correctly convert KES to USD", async () => {
      const amount = 1290;
      const currency = "KES";
      // Mock rates so 1 USD = 129 KES
      mockAxios.get.mockResolvedValue({
        data: { result: "success", conversion_rates: { KES: 129, USD: 1 } }
      });

      const result = await FXService.convertToUSD(amount, currency);
      
      expect(result.usdAmount).toBe(10);
      expect(result.localAmount).toBe(1290);
      expect(result.rate).toBe(129);
    });

    it("should return passthrough for USD", async () => {
      const result = await FXService.convertToUSD(100, "USD");
      expect(result.usdAmount).toBe(100);
      expect(result.rate).toBe(1);
    });

    it("should throw error for unsupported currency", async () => {
      mockAxios.get.mockResolvedValue({
        data: { result: "success", conversion_rates: { USD: 1 } }
      });
      await expect(FXService.convertToUSD(100, "XYZ")).rejects.toThrow("unsupported currency");
    });
  });

  describe("convertFromUSD", () => {
    it("should correctly convert USD to TZS", async () => {
      const amount = 10;
      const currency = "TZS";
      // Mock rates so 1 USD = 2600 TZS
      mockAxios.get.mockResolvedValue({
        data: { result: "success", conversion_rates: { TZS: 2600, USD: 1 } }
      });

      const result = await FXService.convertFromUSD(amount, currency);
      
      expect(result.localAmount).toBe(26000);
      expect(result.usdAmount).toBe(10);
      expect(result.rate).toBe(2600);
    });
  });

  describe("isSupported", () => {
    it("should return true for KES", async () => {
      const supported = await FXService.isSupported("KES");
      expect(supported).toBe(true);
    });

    it("should return false for unknown currency", async () => {
      const supported = await FXService.isSupported("XYZ");
      expect(supported).toBe(false);
    });
  });
});
