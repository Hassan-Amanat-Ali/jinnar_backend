import mongoose from "mongoose";


const systemConfigSchema = new mongoose.Schema({
  // Platform Settings
  defaultCurrency: { type: String, default: "TZS" }, // ISO 4217
  defaultLanguage: { type: String, default: "en" },
  serviceFeePercentage: { type: Number, default: 10, min: 0, max: 100 },
  
  // Feature Controls
  maintenanceMode: { type: Boolean, default: false },
  workerRegistrationEnabled: { type: Boolean, default: true },
  clientRegistrationEnabled: { type: Boolean, default: true },
  autoApprovalEnabled: { type: Boolean, default: false },
  
  // Metadata
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  version: { type: Number, default: 1 }
}, { timestamps: true });

// Ensure singleton pattern
systemConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

export default mongoose.model("SystemConfig", systemConfigSchema);