import mongoose from "mongoose";
import Category from "../src/models/Category.js";
import SubCategory from "../src/models/SubCategory.js";
// CONNECT TO MONGO
const MONGO_URI = "mongodb+srv://abdullahsf99_db_user:MwfxhADxqgIwaZeT@cluster0.gnexivw.mongodb.net/?appName=Cluster0";

const categories = [
  {
    name: "Construction, Maintenance & Technical Services",
    subs: [
      "Bricklayers, Masons, Concrete Workers",
      "Carpenters, Woodworkers",
      "Roofers, Ceiling Installers",
      "Plumbers, Pipe Installers",
      "Electricians, Wiring Technicians",
      "Painters, Polishers",
      "Welders, Fabricators, Metal Workers",
      "Tile & Flooring Installers",
      "Aluminum/Glass Installers",
      "Solar Panel Installers",
      "Air-Conditioning/Fridge Technicians",
      "Generator Technicians",
      "Borehole Drillers & Pump Technicians",
      "Fence Installers",
      "Drainage & Septic Tank Workers",
      "Handymen",
    ]
  },

  {
    name: "Transport, Logistics & Mobility",
    subs: [
      "Motorcycle Taxi Riders",
      "Tuk-tuk/Bajaj/Keke Riders",
      "Taxi & Cab Drivers",
      "Bus & Minibus Drivers",
      "Truck & Long-Haul Drivers",
      "Delivery Couriers",
      "Vehicle Mechanics",
      "Tire Repair Technicians",
      "Vehicle Cleaning/Valet Workers",
      "Porters, Loaders & Movers",
    ]
  },

  {
    name: "Domestic, Personal & Household Services",
    subs: [
      "House Cleaners",
      "Nannies & Babysitters",
      "Elderly Caregivers",
      "Private Cooks & Chefs",
      "Gardeners, Landscapers",
      "Laundry & Ironing",
      "Pest Control",
      "Home Organizing",
      "Pool Cleaning",
      "Water Delivery Services",
    ]
  },

  {
    name: "Beauty, Grooming & Wellness",
    subs: [
      "Barbers",
      "Hairdressers & Braiders",
      "Nail Technicians",
      "Makeup Artists",
      "Massage Therapists",
      "Henna Artists",
      "Herbalists (Non-Medical)",
    ]
  },

  {
    name: "Electronics, Appliances & Repair Services",
    subs: [
      "Phone Repair Technicians",
      "Computer Repair",
      "TV & Electronics Repair",
      "Appliance Repair",
      "Battery Technicians",
      "Locksmiths",
      "Tailor Repair",
      "Shoe Repair",
    ]
  },

  {
    name: "Food, Hospitality & Catering",
    subs: [
      "Street Food Vendors",
      "Caterers",
      "Market Food Sellers",
      "Bakers & Pastry Makers",
      "Juice/Tea Vendors",
      "Chefs & Cooks",
      "Food Delivery",
    ]
  },

  {
    name: "Retail, Sales & Market Trade",
    subs: [
      "Clothing Sellers",
      "Mitumba/Second-Hand Sellers",
      "Cosmetics Sellers",
      "Electronics Dealers",
      "Household Goods Vendors",
      "Furniture Sellers",
      "Daily Market Traders",
      "Kiosk/Duka Owners",
    ]
  },

  {
    name: "Arts, Crafts & Fabrication",
    subs: [
      "Tailors & Designers",
      "Shoe Makers",
      "Leather Artisans",
      "Wood Carvers",
      "Weavers & Basket Makers",
      "Potters/Ceramics",
      "Jewelry & Beadwork Makers",
      "Upholsterers",
    ]
  },

  {
    name: "Events, Media & Entertainment",
    subs: [
      "Photographers & Videographers",
      "DJs",
      "MCs",
      "Event Planners",
      "Event Decorators",
      "Sound/PA System Providers",
      "Tent & Chair Rental",
      "Stage Builders",
      "Performers",
      "Traditional Dancers/Performers",
    ]
  },

  {
    name: "Agriculture, Fishing & Rural Work",
    subs: [
      "Farmers",
      "Poultry & Livestock Keepers",
      "Herders",
      "Fishermen",
      "Irrigation Workers",
      "Produce Processors",
      "Farm Laborers",
      "Market Transporters",
      "Beekeepers",
    ]
  },

  {
    name: "Water, Energy & Environmental Services",
    subs: [
      "Water Suppliers",
      "Water Tank Cleaners",
      "Solar Technicians",
      "Firewood & Charcoal Sellers",
      "Waste Collectors",
      "Scrap Recyclers",
      "Environmental Cleaners",
      "Well/Pump Repair Technicians",
    ]
  },

  {
    name: "Education & Micro-Training",
    subs: [
      "Private Tutors",
      "Music Tutors",
      "Art Instructors",
      "Driving Instructors",
      "Sports Coaches",
    ]
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");

    await Category.deleteMany({});
    await SubCategory.deleteMany({});
    console.log("Cleared old data");

    for (let cat of categories) {
      const category = await Category.create({ name: cat.name });

      for (let sub of cat.subs) {
        await SubCategory.create({
          name: sub,
          categoryId: category._id,
        });
      }
    }

    console.log("Seeding Complete!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
