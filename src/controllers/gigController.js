import Gig from '../models/Gig.js';
import User from '../models/User.js';

export const createGig = async (req, res, next) => {
  try {
    const { id, role } = req.user; // From JWT middleware
    const { title, description, pricingMethod, price, images } = req.body;

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


export const getGigs = async (req, res, next) => {
  try {
    const { pricingMethod, minPrice, maxPrice, title } = req.query;

    // Build query
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

    // Fetch gigs with seller details
    const gigs = await Gig.find(query).populate('sellerId', 'name bio skills');
    res.json({ gigs });
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
    const { title, description, pricingMethod, price, images } = req.body;

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