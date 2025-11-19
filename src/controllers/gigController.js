import Gig from '../models/Gig.js';
import User from '../models/User.js';
import asyncHandler from "express-async-handler";
import Order from '../models/Order.js';

export const createGig = async (req, res, next) => {
  try {
    const { id, role } = req.user; // From JWT middleware
    const { title, description, pricingMethod, price, images , skills } = req.body;

    // ✅ Validate role
    if (role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create gigs' });
    }

    // ✅ Find and verify user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: 'User not verified' });
    }

    // ✅ Validate input
    if (!title || !description || !pricingMethod) {
      return res.status(400).json({ error: 'Title, description, and pricing method are required' });
    }
    if(!skills || skills.length === 0){
      return res.status(400).json({ error: 'At least one skill/category is required' });
    }
    if (!['fixed', 'hourly', 'negotiable'].includes(pricingMethod)) {
      return res.status(400).json({ error: 'Pricing method must be fixed, hourly, or negotiable' });
    }
    if (pricingMethod !== 'negotiable' && (price === undefined || price < 0)) {
      return res.status(400).json({ error: 'Price is required for fixed or hourly pricing and cannot be negative' });
    }

    // ✅ Create gig
    const gig = new Gig({
      sellerId: id,
      title,
      description,
      pricing: {
        method: pricingMethod,
        price: pricingMethod === 'negotiable' ? undefined : price,
      },
      images: Array.isArray(images)
        ? images.map(url => ({ url, publicId: null }))
        : [],
        skills: skills
    });

    await gig.save();
    await gig.populate('sellerId', 'name bio skills');

    res.status(201).json({
      message: 'Gig created successfully',
      gig,
    });

  } catch (error) {
    console.error('Create Gig Error:', error.message);
    next(error);
  }
};

export const getSkills = async (req, res) => {
  try {
    // Fetch only the "skills" field from all gigs
    const gigs = await Gig.find({}, { skills: 1, _id: 0 });

    // Flatten and dedupe skills
    const result = [
      ...new Set(
        gigs
          .filter(g => Array.isArray(g.skills))
          .flatMap(g => g.skills.map(s => s.trim().toLowerCase()))
      )
    ];

    res.json({
      success: true,
      count: result.length,
      skills: result
    });
  } catch (error) {
    console.log("Error getting skills: ", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getAllGigs = async (req, res, next) => {
  try {
    const { pricingMethod, minPrice, maxPrice, title } = req.query;

    // -------------------------
    // Build Query
    // -------------------------
    const query = {};

    if (pricingMethod) {
      query['pricing.method'] = pricingMethod;
    }

    if (minPrice || maxPrice) {
      query['pricing.price'] = {};
      if (minPrice) query['pricing.price'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.price'].$lte = Number(maxPrice);
    }

    if (title) {
      query.title = { $regex: title, $options: 'i' }; // Case-insensitive search
    }

    // -------------------------
    // Fetch Gigs & Seller Info
    // -------------------------
    const gigs = await Gig.find(query)
      .populate('sellerId', 'name bio skills yearsOfExperience rating');

    // -------------------------
    // Append Orders Completed per Seller
    // -------------------------
    const sellerIds = gigs.map(g => g.sellerId?._id);

    // Count completed orders for all sellers at once
    const completedOrders = await Order.aggregate([
      { $match: { sellerId: { $in: sellerIds }, status: 'completed' } },
      { $group: { _id: '$sellerId', count: { $sum: 1 } } }
    ]);

    // Convert to lookup map
    const orderCountMap = {};
    completedOrders.forEach(entry => {
      orderCountMap[entry._id.toString()] = entry.count;
    });

    // Inject into gig objects
    const enrichedGigs = gigs.map(gig => {
      const seller = gig.sellerId;
      const ordersCompleted = orderCountMap[seller._id.toString()] || 0;

      return {
        ...gig.toObject(),
        sellerId: {
          ...seller.toObject(),
          ordersCompleted,           // 👈 added
          yearsOfExperience: seller.yearsOfExperience || 0, // already in schema
        }
      };
    });

    res.json({ gigs: enrichedGigs });

  } catch (error) {
    console.error('Get Gigs Error:', error.message);
    next(error);
  }
};


// ✅ NEW: GET MY GIGS (Add this)
export const getMyGigs = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can view their gigs' });
    }

    const gigs = await Gig.find({ sellerId: id })
      .populate('sellerId', 'name bio skills')
      .sort({ createdAt: -1 });

    res.json({ gigs });
  } catch (error) {
    console.error('Get My Gigs Error:', error.message);
    next(error);
  }
};

export const updateGig = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const { title, description, pricingMethod, price, images,skills } = req.body;

    if (role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can update gigs' });
    }

    const gig = await Gig.findOne({ _id: req.params.id, sellerId: id });
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // ✅ BASIC FIELDS
    if (title !== undefined) gig.title = title;
    if (description !== undefined) gig.description = description;
 if(!skills || skills.length === 0){
      return res.status(400).json({ error: 'At least one skill/category is required' });
    }
    else {
      gig.skills = skills;
    }
    // ✅ PRICING
    if (pricingMethod !== undefined) {
      gig.pricing.method = pricingMethod;
      if (pricingMethod === 'negotiable') {
        gig.pricing.price = undefined;
      } else if (price !== undefined) {
        if (price < 0) {
          return res.status(400).json({ error: 'Price cannot be negative' });
        }
        gig.pricing.price = price;
      }
    }

    // ✅ IMAGES (raw JSON array of URLs)
    if (Array.isArray(images)) {
      gig.images = images.map(url => ({ url, publicId: null }));
    }

    await gig.save();
    await gig.populate('sellerId', 'name bio skills');

    res.json({
      message: 'Gig updated successfully',
      gig
    });

  } catch (error) {
    console.error('Update Gig Error:', error.message);
    next(error);
  }
};

export const getGigById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const gig = await Gig.findById(id).populate('sellerId', 'name profilePicture');

  if (!gig) {
    return res.status(404).json({ success: false, message: 'Gig not found' });
  }

  res.json({ success: true, gig });
});


// ✅ NEW: DELETE GIG (Add this)
export const deleteGig = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can delete gigs' });
    }

    const gig = await Gig.findOneAndDelete({ _id: req.params.id, sellerId: id });
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    res.json({ message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Delete Gig Error:', error.message);
    next(error);
  }
};