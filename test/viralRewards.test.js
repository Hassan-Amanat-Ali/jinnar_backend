import { jest } from "@jest/globals";

const makeChain = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
  session: jest.fn().mockReturnThis(),
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mocks
const mockReward = {
  find: jest.fn(),
  findById: jest.fn(),
  insertMany: jest.fn(),
};

const mockDraw = {
  findById: jest.fn(),
};

const mockPost = {
  aggregate: jest.fn(),
};

const mockSubmission = {};
const mockUser = {
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  distinct: jest.fn(),
};

const mockWallet = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockSendNotification = jest.fn();

jest.unstable_mockModule("../src/models/Reward.js", () => ({ default: mockReward }));
jest.unstable_mockModule("../src/models/Draw.js", () => ({ default: mockDraw }));
jest.unstable_mockModule("../src/models/Post.js", () => ({ default: mockPost }));
jest.unstable_mockModule("../src/models/Submission.js", () => ({ default: mockSubmission }));
jest.unstable_mockModule("../src/models/User.js", () => ({ default: mockUser }));
jest.unstable_mockModule("../src/models/Wallet.js", () => ({ default: mockWallet }));
jest.unstable_mockModule("../src/controllers/notificationController.js", () => ({
  sendNotification: mockSendNotification,
}));

jest.unstable_mockModule("mongoose", () => ({
  default: {
    Types: {
      ObjectId: class MockObjectId {
        constructor(value) {
          this.value = value;
        }
        toString() {
          return String(this.value);
        }
      },
    },
    startSession: jest.fn(async () => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    })),
  },
}));

const controller = await import("../src/controllers/viralController.js");

describe("Viral rewards flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getWinners filters approved winners only", async () => {
    mockReward.find.mockReturnValue(makeChain([]));

    const req = { params: { drawId: "draw1" } };
    const res = makeRes();

    await controller.getWinners(req, res, (e) => {
      throw e;
    });

    expect(mockReward.find).toHaveBeenCalledWith({
      drawId: "draw1",
      $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  test("createRewards rejects when total rewards exceed prizePool", async () => {
    mockDraw.findById.mockReturnValue(makeChain({ prizePool: 100 }));
    mockReward.find.mockReturnValue(makeChain([{ amount: 80 }]));

    const req = {
      params: { drawId: "draw1" },
      body: [{ rank: 1, rewardType: "cash", amount: 30 }],
    };
    const res = makeRes();

    await controller.createRewards(req, res, (e) => {
      throw e;
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockReward.insertMany).not.toHaveBeenCalled();
  });

  test("approveReward returns 409 if already approved/paid", async () => {
    const rewardDoc = {
      _id: "reward1",
      winnerUserId: "user1",
      approvalStatus: "approved",
      status: "paid",
    };

    mockReward.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(rewardDoc),
    });

    const req = { params: { rewardId: "reward1" }, body: {}, user: { _id: "admin1" } };
    const res = makeRes();

    await controller.approveReward(req, res, (e) => {
      throw e;
    });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test("getMyRewards returns activeRewards + rejections", async () => {
    const userId = "user1";
    const active = [
      {
        _id: "r1",
        rank: 1,
        drawId: { _id: "d1", title: "Draw 1", rewardBannerImageUrl: "/uploads/viral/draw-banners/a.png" },
      },
    ];
    const rejected = [
      {
        _id: "r2",
        rank: 2,
        drawId: { _id: "d1", title: "Draw 1" },
        reviewHistory: [
          { action: "rejected", userId: { toString: () => userId }, reason: "bad proof", at: new Date("2026-01-01") },
        ],
      },
    ];

    mockReward.find.mockImplementation((query) => {
      if (query?.winnerUserId === userId) return makeChain(active);
      if (query?.["reviewHistory.userId"] === userId) return makeChain(rejected);
      return makeChain([]);
    });

    const req = { user: { _id: userId } };
    const res = makeRes();

    await controller.getMyRewards(req, res, (e) => {
      throw e;
    });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          activeRewards: active,
          rejections: [
            expect.objectContaining({
              drawId: "d1",
              drawTitle: "Draw 1",
              rank: 2,
              reason: "bad proof",
            }),
          ],
        }),
      }),
    );
  });
});
