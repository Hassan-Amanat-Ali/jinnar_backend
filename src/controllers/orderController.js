// controllers/jobRequestController.js
import Order from "../models/Order.js";
import Gig from "../models/Gig.js";
import User from "../models/User.js";
import { getUserWallet } from "./walletController.js";
import Wallet from "../models/Wallet.js"; // Import Wallet model
import { sendNotification } from "./notificationController.js";

// ───────────────────────────────────────
// 1. CREATE JOB REQUEST (Buyer)
// ───────────────────────────────────────

export const createJobRequest = async (req, res) => {
  try {
    const { id: buyerId } = req.user;
    const {
      gigId,
      date,
      timeSlot,
      jobDescription,
      image,
      lat,
      lng,
      emergency,
    } = req.body;

    if (!gigId || !date || !timeSlot || !jobDescription || !lat || !lng) {
      return res
        .status(400)
        .json({
          error: "gigId, date, timeSlot, description, lat, lng are required",
        });
    }

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ error: "Gig not found" });
    if (gig.sellerId.toString() === buyerId)
      return res
        .status(400)
        .json({ error: "You cannot create a job request for your own gig" });

    let jobPrice = 0;
    // ✅ Check for sufficient funds if the gig has a price
    if (
      gig.pricing &&
      gig.pricing.method !== "negotiable" &&
      gig.pricing.price > 0
    ) {
      jobPrice = gig.pricing.price;
      const buyerWallet = await Wallet.findOne({ userId: buyerId }); // Use Wallet model directly
      if (!buyerWallet) {
        return res.status(404).json({ error: "Buyer wallet not found" });
      }

      if (buyerWallet.balance < jobPrice) {
        return res.status(402).json({
          error: "Insufficient funds in wallet.",
          message: `Your balance is ${buyerWallet.balance}, but the job requires ${jobPrice}. Please top up your wallet.`,
        });
      }
    }

    const newJob = await Order.create({
      gigId,
      sellerId: gig.sellerId,
      buyerId,
      date,
      timeSlot,
      jobDescription,
      image: image || null,
      location: { lat, lng },
      emergency: emergency || false,
      price: jobPrice, // Store the job price with the order
    });

    // Update the transaction with the newJob's ID - This block is no longer needed here
    // if (jobPrice > 0) {
    //   const buyerWallet = await Wallet.findOne({ userId: buyerId });
    //   if (buyerWallet) {
    //     const transaction = buyerWallet.transactions.find(
    //       (tx) => tx.description === "Funds held for new job request" && tx.status === "pending" && tx.amount === jobPrice
    //     );
    //     if (transaction) {
    //       transaction.orderId = newJob._id;
    //       await buyerWallet.save();
    //     }
    //   }
    // }

    // 👇 Notify seller about new job request
    await sendNotification(
      gig.sellerId,
      "booking",
      `You have a new job request for "${gig.title}"`,
      newJob._id,
      "Order",
    );

    res.status(201).json({
      success: true,
      message: "Job request created successfully",
      data: newJob,
    });
  } catch (error) {
    console.error("Error creating job request:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// ───────────────────────────────────────
// 2.  JOB REQUESTS (Buyer)
// ───────────────────────────────────────
export const getAllJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

export const getPendingJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
      status: "pending",
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

export const getCompletedJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
      status: "completed",
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

export const getOngoingJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
      status: "accepted",
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

export const getDeclinedJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
      status: "rejected",
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

export const getCancelledJobRequests = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    const jobs = await Order.find({
      sellerId: sellerId,
      status: "cancelled",
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching job requests:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch job requests: " + error.message });
  }
};

// ───────────────────────────────────────
// 3. GET AVAILABLE JOBS (Seller)
// ───────────────────────────────────────
export const getAvailableJobs = async (req, res) => {
  try {
    const { id } = req.user;
    const jobs = await Order.find({
      status: "open",
      buyerId: { $ne: id },
      declinedBy: { $ne: id },
    })
      .populate("buyerId", "name profileImage")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" + error });
  }
};

// ───────────────────────────────────────
// 4. ACCEPT JOB (Seller)
// ───────────────────────────────────────
export const acceptJob = async (req, res) => {
  try {
    const { id: sellerId, name } = req.user;
    const { id } = req.body;
    const job = await Order.findById(id);
    if (!job || job.status !== "pending")
      return res.status(400).json({ error: "Job not available" });

    job.status = "accepted";
    job.acceptedBy = sellerId;
    job.acceptedAt = new Date();
    await job.save();

    // 💰 Handle fund holding for accepted job
    if (job.price > 0) {
      const buyerWallet = await Wallet.findOne({ userId: job.buyerId });
      if (!buyerWallet) {
        console.error(`Buyer wallet not found for accepted order ${job._id}. Funds cannot be held.`);
        return res.status(500).json({ error: "Buyer wallet not found, cannot hold funds." });
      }

      // Check if funds are still sufficient (though already checked at creation, this is a safety)
      // Note: At this point, balance is just a numeric value, and we are trusting the initial check.
      // If the balance could have changed externally, a re-check here would be prudent.
      if (buyerWallet.balance < job.price) {
        // This scenario should ideally not happen if initial check was strong and no external debits occurred
        console.error(`Insufficient funds in buyer wallet for accepted order ${job._id}. Balance: ${buyerWallet.balance}, Price: ${job.price}`);
        // Consider reverting job status or marking as payment_failed, but for now, throw error.
        return res.status(402).json({ error: "Insufficient funds in wallet for holding." });
      }


      buyerWallet.balance -= job.price;
      buyerWallet.onHoldBalance += job.price;
      buyerWallet.transactions.push({
        type: "order_paid",
        amount: job.price,
        status: "pending",
        orderId: job._id,
        description: "Funds held for accepted job request",
      });
      await buyerWallet.save();
    }

    // 👇 Notify buyer that seller accepted the job
    await sendNotification(
      job.buyerId,
      "booking",
      `${name || "Seller"} accepted your job request.`,
      job._id,
      "Order",
    );

    res.json({ message: "Job accepted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept " + error });
  }
};

// ───────────────────────────────────────
// 5. DECLINE JOB (Seller)
// ───────────────────────────────────────
export const declineJob = async (req, res) => {
  try {
    const { id: sellerId } = req.user;
    const { id } = req.body; // order id

    const job = await Order.findById(id);
    if (!job) return res.status(404).json({ error: "Order not found" });
    if (job.status !== "pending")
      return res
        .status(400)
        .json({ error: "Only pending jobs can be declined" });

    // Ensure only the seller who received the request can decline
    if (job.sellerId.toString() !== sellerId)
      return res
        .status(403)
        .json({ error: "You are not authorized to decline this job" });

    job.status = "rejected";
    await job.save();

    // Send notification to buyer
    await sendNotification(
      job.buyerId,
      "booking",
      `Your job request was declined by the seller.`,
      job._id,
      "Order",
    );

    res.json({ message: "Job declined successfully" });
  } catch (error) {
    console.error("Decline error:", error);
    res.status(500).json({ error: "Failed to decline job: " + error.message });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { id: buyerId } = req.user; // ✅ from bearer token
    const { orderId } = req.body; // order ID passed in body

    // ✅ Check required field
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    // ✅ Fetch the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // ✅ Ensure this user is the buyer
    if (order.buyerId.toString() !== buyerId) {
      return res
        .status(403)
        .json({ error: "You can only cancel your own order" });
    }

    // ✅ Allow cancel only if open/pending/accepted
    if (!["open", "pending", "accepted"].includes(order.status)) {
      return res
        .status(400)
        .json({ error: "Order cannot be canceled at this stage" });
    }

    // ✅ Update order
    order.status = "cancelled";
    order.canceledAt = new Date();
    await order.save();

    // 💰 Release held funds if the order was accepted and had a price
    if (order.price > 0 && order.status === "accepted") { // Check if funds were actually put on hold
      const buyerWallet = await Wallet.findOne({ userId: buyerId });
      if (buyerWallet) {
        const buyerTransaction = buyerWallet.transactions.find(
          (tx) => tx.orderId && tx.orderId.toString() === orderId.toString() && tx.type === "order_paid" && tx.status === "pending"
        );

        if (buyerTransaction) {
          buyerWallet.onHoldBalance -= order.price; // Deduct from onHoldBalance
          buyerWallet.balance += order.price; // Return to available balance
          buyerTransaction.status = "cancelled"; // Mark buyer's transaction as cancelled
          await buyerWallet.save();
        } else {
          console.warn(`Pending transaction not found for cancelled order ${order._id} (status: ${order.status}). Funds not released.`);
        }
      } else {
        console.warn(`Buyer wallet not found for cancelled order ${order._id} (status: ${order.status}). Funds not released.`);
      }
    } else if (order.price > 0 && !["accepted"].includes(order.status)) {
        console.log(`Order ${order._id} was cancelled before acceptance. No funds were held.`);
    }

    // ✅ Notify seller (if any)
    if (order.sellerId) {
      await sendNotification(
        order.sellerId,
        "booking",
        `A job request was canceled by the buyer.`,
        order._id,
        "Order",
      );
    }

    res.json({
      success: true,
      message: "Order canceled successfully",
      order,
    });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel order",
      details: error.message,
    });
  }
};

// ───────────────────────────────────────
// 6. SEND MESSAGE (Buyer/Seller)
// ───────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, attachments } = req.body;
    const { id: senderId } = req.user;

    const job = await Order.findById(id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const isParticipant =
      job.buyerId.toString() === senderId ||
      (job.acceptedBy && job.acceptedBy.toString() === senderId);
    if (!isParticipant)
      return res.status(403).json({ error: "Not authorized" });

    job.messages.push({
      senderId,
      content,
      attachments,
    });
    await job.save();

    res.json({ message: "Message sent" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send" + error });
  }
};

// ───────────────────────────────────────
// 7. MARK MESSAGES READ
// ───────────────────────────────────────
export const markMessagesRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    const job = await Order.findById(id);
    if (!job) return res.status(404).json({ error: "Not found" });

    job.messages.forEach((msg) => {
      if (msg.senderId.toString() !== userId && !msg.read) {
        msg.read = true;
      }
    });
    await job.save();

    res.json({ message: "Messages marked read" });
  } catch (error) {
    res.status(500).json({ error: "Failed" + error });
  }
};

// ───────────────────────────────────────
// 8. UPLOAD DELIVERABLE (Seller)
// ───────────────────────────────────────
export const uploadDeliverable = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, publicId, description } = req.body;
    const { id: sellerId, name } = req.user;

    const job = await Order.findById(id);
    if (!job || job.acceptedBy.toString() !== sellerId)
      return res.status(403).json({ error: "Not your job" });
    if (job.status !== "accepted")
      return res.status(400).json({ error: "Job not accepted" });

    job.deliverables.push({
      url,
      publicId,
      description,
      uploadedBy: sellerId,
    });
    job.status = "completed";
    await job.save();

    // 👇 Notify buyer that work is delivered
    await sendNotification(
      job.buyerId,
      "booking",
      `${name || "Seller"} has submitted the deliverables for your job.`,
      job._id,
      "Order",
    );

    res.json({ message: "Work delivered. Awaiting payment." });
  } catch (error) {
    res.status(500).json({ error: "Failed to deliver " + error });
  }
};

// ───────────────────────────────────────
// 9. PAY & REVIEW (Buyer)
// ───────────────────────────────────────
export const rateAndReviewOrder = async (req, res) => {
  try {
    const { id: buyerId } = req.user; // from token
    const { orderId, rating, review } = req.body;

    // 1️⃣ Validate input
    if (!orderId || rating == null) {
      return res.status(400).json({ error: "orderId and rating are required" });
    }

    if (rating < 0 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 0 and 5" });
    }

    // 2️⃣ Find order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // 3️⃣ Verify ownership
    if (order.buyerId.toString() !== buyerId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to review this order" });
    }

    // 4️⃣ Only completed orders can be reviewed
    if (order.status !== "completed") {
      return res
        .status(400)
        .json({ error: "You can only rate a completed order" });
    }

    // 5️⃣ Prevent duplicate review
    if (order.rating !== null) {
      return res
        .status(400)
        .json({ error: "You have already rated this order" });
    }

    // 6️⃣ Save rating and review
    order.rating = rating;
    order.review = review || null;
    await order.save();

    // 7️⃣ Update seller’s average rating
    const seller = await User.findById(order.sellerId);
    if (seller) {
      // Save review into seller.reviews for record and compute average from these
      if (!Array.isArray(seller.reviews)) seller.reviews = [];

      seller.reviews.push({
        orderId: order._id,
        reviewer: buyerId,
        rating,
        review: review || null,
      });

      // Compute average from stored reviews
      const total = seller.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      const count = seller.reviews.length;
      const avg = count ? total / count : 0;

      seller.rating.average = parseFloat(avg.toFixed(2));
      seller.rating.count = count;
      await seller.save();

      // 8️⃣ Notify seller
      await sendNotification(
        seller._id,
        "rating",
        `You received a new rating of ${rating}★ from a buyer.`,
        order._id,
        "Order",
      );
    }

    res.json({
      message: "Review submitted successfully",
      order,
    });
  } catch (error) {
    console.error("Error rating order:", error);
    res.status(500).json({ error: "Failed to rate order: " + error.message });
  }
};

// ───────────────────────────────────────
// 10. GET MY ORDERS (Buyer + Seller)
// ───────────────────────────────────────
export const getMyOrders = async (req, res) => {
  try {
    const { id } = req.user;

    console.log("User Role : ", req.user);
    let filter = {};
    filter = {
      $or: [{ buyerId: id }, { sellerId: id }],
    };

    const jobs = await Order.find(filter)
      .populate("buyerId", "name profileImage")
      .populate("sellerId", "name profileImage")
      .sort({ createdAt: -1 });

    res.json({ orders: jobs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" + error });
  }
};

//11. Complete Order (Buyer)
export const completeOrder = async (req, res) => {
  try {
    const { id: buyerId } = req.user;
    const { id } = req.body; // order id

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    console.log("Order Id : ", order._id);
    console.log("current uId : ", buyerId);
    console.log("order buyer id : ", order.buyerId.toString());
    // Check buyer ownership
    if (order.buyerId.toString() !== buyerId)
      return res
        .status(403)
        .json({ error: "You are not authorized to complete this order" });

    // Only allow completing accepted orders
    if (order.status !== "accepted")
      return res
        .status(400)
        .json({ error: "Only ongoing orders can be completed" });

    order.status = "completed";
    order.completedAt = new Date();
    await order.save();

    // 💰 Handle fund transfer from buyer's onHoldBalance to seller's balance
    if (order.price > 0) {
      const buyerWallet = await Wallet.findOne({ userId: buyerId });
      const sellerWallet = await Wallet.findOne({ userId: order.sellerId });

      if (buyerWallet && sellerWallet) {
        // Find and update buyer's pending transaction
        const buyerTransaction = buyerWallet.transactions.find(
          (tx) => tx.orderId && tx.orderId.toString() === order._id.toString() && tx.type === "order_paid" && tx.status === "pending"
        );

        if (buyerTransaction) {
          buyerWallet.onHoldBalance -= order.price; // Deduct from onHoldBalance
          buyerTransaction.status = "completed"; // Mark buyer's transaction as completed
        }

        sellerWallet.balance += order.price; // Add to seller's balance
        sellerWallet.transactions.push({
          type: "order_earned",
          amount: order.price,
          status: "completed",
          orderId: order._id,
          description: "Funds received for completed job",
        });

        await buyerWallet.save();
        await sellerWallet.save();
      } else {
        console.warn(`Wallets not found for order ${order._id}. Funds not transferred.`);
      }
    }
    else {
      console.log(`Order ${order._id} has no price. No fund transfer needed.`);
    }

    // Notify seller
    await sendNotification(
      order.sellerId,
      "booking",
      `The buyer has marked your order as completed.`,
      order._id,
      "Order",
    );

    res.json({ message: "Order marked as completed successfully", order });
  } catch (error) {
    console.error("Error completing order:", error);
    res
      .status(500)
      .json({ error: "Failed to complete order: " + error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { id } = req.params; // orderId

    // Validate ID format
    if (!id || id.length !== 24) {
      return res.status(400).json({ error: "Invalid Order ID" });
    }

    // Fetch order with populated buyer and seller
    const order = await Order.findById(id)
      .populate("buyerId", "name profileImage")
      .populate("sellerId", "name profileImage")
      .populate("gigId", "title price skills images");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Permission check (buyer or seller can view)
    if (
      order.buyerId?._id.toString() !== userId &&
      order.sellerId?._id.toString() !== userId
    ) {
      return res.status(403).json({ error: "Unauthorized to view this order" });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order: " + error });
  }
};

// ───────────────────────────────────────
// 12. GET SELLER QUICK STATS
// ───────────────────────────────────────
export const getSellerQuickStats = async (req, res) => {
  try {
    const { id: sellerId } = req.user;

    // 1. Completed Jobs
    const completedJobsCount = await Order.countDocuments({
      sellerId: sellerId,
      status: "completed",
    });

    // 2. Active Jobs (accepted status)
    const activeJobsCount = await Order.countDocuments({
      sellerId: sellerId,
      status: "accepted",
    });

    // 3. Pending Earning (sum of gig prices for accepted jobs)
    const acceptedOrders = await Order.find({
      sellerId: sellerId,
      status: "accepted",
    }).populate("gigId", "pricing"); // Populate only the pricing field of the gig

    let pendingEarning = 0;
    acceptedOrders.forEach((order) => {
      if (order.gigId && order.gigId.pricing && order.gigId.pricing.price > 0) {
        pendingEarning += order.gigId.pricing.price;
      }
    });

    res.json({
      completedJobs: completedJobsCount,
      activeJobs: activeJobsCount,
      pendingEarning: pendingEarning,
    });
  } catch (error) {
    console.error("Error fetching seller quick stats:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch seller quick stats: " + error.message });
  }
};
