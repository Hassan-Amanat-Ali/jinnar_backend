import SystemConfig from "../models/SystemConfig.js";

/**
 * @description Get the current system configuration
 * @route GET /api/config
 * @access Public (or Protected based on needs, usually Public for feature flags)
 */
export const getSystemConfig = async (req, res) => {
  try {
    // getConfig is a static method we defined in the schema to ensure singleton
    const config = await SystemConfig.getConfig();
    res.json(config);
  } catch (error) {
    console.error("Get System Config Error:", error);
    res.status(500).json({ error: "Failed to fetch system configuration" });
  }
};

/**
 * @description Update system configuration
 * @route PUT /api/config
 * @access Admin Only
 */
export const updateSystemConfig = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user.id;

    // Prevent updating immutable fields if any (e.g., _id)
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Add metadata
    updates.lastUpdatedBy = userId;

    // Find the single config document and update it
    // We use findOneAndUpdate because there should only be one document
    const config = await SystemConfig.findOneAndUpdate(
      {}, 
      { $set: updates, $inc: { version: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "System configuration updated", config });
  } catch (error) {
    console.error("Update System Config Error:", error);
    res.status(500).json({ error: "Failed to update system configuration" });
  }
};
