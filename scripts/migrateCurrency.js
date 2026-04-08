// scripts/migrateCurrency.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "path";
import Gig from "../src/models/Gig.js";
import Order from "../src/models/Order.js";
import FXService from "../src/services/fxService.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const MIGRATION_CURRENCY = "TZS";

async function migrateData() {
  try {
    console.log("Starting currency migration...");
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database.");

    // Migrate Gigs
    const gigs = await Gig.find({});
    console.log(`Found ${gigs.length} gigs to inspect.`);
    let gigUpdateCount = 0;

    for (const gig of gigs) {
      // If the gig doesn't have an original currency, it hasn't been migrated
      if (!gig.pricing.originalCurrency) {
        let updated = false;

        const originalFixedPrice = gig.pricing?.fixed?.price;
        const originalHourlyRate = gig.pricing?.hourly?.rate;

        // Set the original currency
        gig.pricing.originalCurrency = MIGRATION_CURRENCY;
        const fxRate = FXService.getRate(MIGRATION_CURRENCY);
        gig.pricing.fxRate = fxRate;

        if (originalFixedPrice !== undefined && originalFixedPrice > 0) {
          const fx = await FXService.convertToUSD(originalFixedPrice, MIGRATION_CURRENCY);
          gig.pricing.fixed.price = fx.usdAmount;
          gig.pricing.originalFixedPrice = originalFixedPrice;
          updated = true;
        }

        if (originalHourlyRate !== undefined && originalHourlyRate > 0) {
          const fx = await FXService.convertToUSD(originalHourlyRate, MIGRATION_CURRENCY);
          gig.pricing.hourly.rate = fx.usdAmount;
          gig.pricing.originalHourlyRate = originalHourlyRate;
          updated = true;
        }

        // Even if prices were 0 or missing but gig had no metadata, we mark it updated to set TZS defaults
        if (updated || gig.pricing.originalCurrency) {
           await Gig.updateOne({ _id: gig._id }, { $set: { pricing: gig.pricing } });
           gigUpdateCount++;
        }
      }
    }
    console.log(`Migrated ${gigUpdateCount} gigs from ${MIGRATION_CURRENCY} to USD.`);

    // Migrate Orders
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders to inspect.`);
    let orderUpdateCount = 0;

    for (const order of orders) {
      if (!order.originalCurrency) {
        const originalPrice = order.price;
        order.originalCurrency = MIGRATION_CURRENCY;
        const fxRate = FXService.getRate(MIGRATION_CURRENCY);
        order.fxRate = fxRate;
        order.originalPrice = originalPrice;
        order.pricingCurrency = "USD";

        if (originalPrice > 0) {
          const fx = await FXService.convertToUSD(originalPrice, MIGRATION_CURRENCY);
          order.price = fx.usdAmount;
        }
        
        await Order.updateOne(
          { _id: order._id },
          { 
            $set: { 
              price: order.price,
              originalCurrency: order.originalCurrency,
              fxRate: order.fxRate,
              originalPrice: order.originalPrice,
              pricingCurrency: order.pricingCurrency
            } 
          }
        );
        orderUpdateCount++;
      }
    }
    console.log(`Migrated ${orderUpdateCount} orders from ${MIGRATION_CURRENCY} to USD.`);

    console.log("Migration complete!");
    process.exit(0);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateData();
