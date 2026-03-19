import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';

// Load env vars
dotenv.config();

// Direct Import of Models based on file analysis
import User from '../src/models/User.js';
import Gig from '../src/models/Gig.js';
import Order from '../src/models/Order.js';
import Category from '../src/models/Category.js';
import SubCategory from '../src/models/SubCategory.js';
import Review from '../src/models/Review.js';

// --- Configuration ---
const WORKER_COUNT = 20;
const BUYER_COUNT = 10;
const ORDERS_PER_WORKER_MIN = 3;
const ORDERS_PER_WORKER_MAX = 8;

// --- Professional Data Assets ---
const PROFESSIONAL_BIOS = [
    "I am a highly skilled professional with over 10 years of experience in the industry. I take pride in delivering high-quality work and ensuring customer satisfaction.",
    "Certified expert specializing in efficient and reliable service. I have a proven track record of solving complex problems quickly.",
    "Dedicated and detail-oriented service provider. I focus on precision and safety in every project I undertake.",
    "Experienced technician offering top-notch services with a focus on quality and durability. satisfaction guaranteed.",
    "Professional, punctual, and reliable. I bring years of expertise to handle your needs with care and professionalism."
];

const PROFILE_IMAGES = [
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop", // man
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop", // woman
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop", // man professional
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop", // woman professional
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop", // man
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop", // woman
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", // man
    "https://images.unsplash.com/photo-1598550874175-4d7112ee7f43?w=400&h=400&fit=crop", // woman
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop", // man
    "https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=400&h=400&fit=crop"  // woman
];

const GIG_IMAGES = [
    "https://images.unsplash.com/photo-1581578731117-104f2a863a17?w=800&fit=crop", // repairs
    "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&fit=crop", // painting
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&fit=crop", // cleaning
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&fit=crop", // electrical
    "https://images.unsplash.com/photo-1595814433015-e6f5ce69614e?w=800&fit=crop", // plumbing
    "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=800&fit=crop" // gardening
];

// Locations around a central point (Approx 24.8607 N, 67.0011 E - Karachi example, or general)
const BASE_LAT = 24.8607;
const BASE_LNG = 67.0011;

const getRandomLocation = () => {
    const r = 0.05; // ~5km radius
    return {
        type: "Point",
        coordinates: [
            BASE_LNG + (Math.random() * r * 2 - r),
            BASE_LAT + (Math.random() * r * 2 - r)
        ]
    };
};

// --- Helpers ---
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Main Script ---
const seedData = async () => {
    try {
        // 1. Connect
        console.log('Connecting to MongoDB...');
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI environment variable is not set in .env');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Fetch Categories
        console.log('Fetching Categories...');
        const categories = await Category.find({});
        if (categories.length === 0) {
            console.error('❌ No categories found! Please ensure categories are seeded first.');
            process.exit(1);
        }
        console.log(`✅ Found ${categories.length} categories.`);

        // 3. Create Buyers
        console.log('Creating Buyers...');
        const buyers = [];
        for (let i = 0; i < BUYER_COUNT; i++) {
            const buyer = new User({
                name: faker.person.fullName(),
                email: faker.internet.email().toLowerCase(),
                password: 'password123', // Will be hashed by pre-save
                role: 'buyer',
                emailVerified: true,
                isVerified: true,
                profilePicture: getRandomElement(PROFILE_IMAGES),
                location: getRandomLocation(),
                address: faker.location.streetAddress(),
            });
            await buyer.save();
            buyers.push(buyer);
        }
        console.log(`✅ Created ${buyers.length} buyers.`);

        // 4. Create Sellers (Workers)
        console.log('Creating Workers & Gigs...');
        for (let i = 0; i < WORKER_COUNT; i++) {
            // Assign a random primary category
            const category = getRandomElement(categories);
            const subCategories = await SubCategory.find({ categoryId: category._id });
            const subCategory = subCategories.length > 0 ? getRandomElement(subCategories) : null;

            const workerName = faker.person.fullName();
            const worker = new User({
                name: workerName,
                email: faker.internet.email(workerName.split(' ')[0]).toLowerCase(), // try to keep email relevant
                password: 'password123',
                role: 'seller',
                isVerified: true,
                verification: { status: 'verified' },
                profilePicture: getRandomElement(PROFILE_IMAGES),
                bio: getRandomElement(PROFESSIONAL_BIOS),
                location: getRandomLocation(),
                address: faker.location.streetAddress(),
                skills: [category.name, subCategory ? subCategory.name : 'General Service'],
                yearsOfExperience: faker.number.int({ min: 2, max: 15 }),
                languages: ['English', 'Urdu'],
                categories: [category._id],
                subcategories: subCategory ? [subCategory._id] : [],
            });
            await worker.save();

            // Create 1-2 Gigs for this worker
            const gigCount = faker.number.int({ min: 1, max: 2 });
            for (let g = 0; g < gigCount; g++) {
                // Ensure we have a subcategory
                if (!subCategory) continue;

                const gig = new Gig({
                    sellerId: worker._id,
                    title: `Professional ${subCategory.name} Services`,
                    description: `I provide top-quality ${subCategory.name} services. ${getRandomElement(PROFESSIONAL_BIOS)}`,
                    category: category._id,
                    primarySubcategory: subCategory._id,
                    images: [
                        { url: getRandomElement(GIG_IMAGES) },
                        { url: getRandomElement(GIG_IMAGES) }
                    ],
                    pricing: {
                        inspection: { enabled: true },
                        fixed: { enabled: true, price: faker.number.int({ min: 20, max: 100 }) * 10 }
                    },
                    location: worker.location,
                    address: worker.address,
                    status: 'active'
                });
                await gig.save();

                // Create Past Orders/Reviews for this Gig
                const orderCount = faker.number.int({ min: ORDERS_PER_WORKER_MIN, max: ORDERS_PER_WORKER_MAX });
                for (let o = 0; o < orderCount; o++) {
                    const buyer = getRandomElement(buyers);
                    const rating = faker.number.int({ min: 4, max: 5 }); // Mostly good ratings

                    const order = new Order({
                        gigId: gig._id,
                        buyerId: buyer._id,
                        sellerId: worker._id,
                        date: faker.date.recent({ days: 60 }).toISOString().split('T')[0],
                        timeSlot: 'Morning',
                        jobDescription: `Need help with ${subCategory.name}`,
                        status: 'completed',
                        selectedPricingMethod: 'fixed',
                        price: gig.pricing.fixed.price,
                        rating: rating,
                        review: faker.lorem.sentence()
                    });
                    await order.save();

                    // Create Review entry
                    const review = new Review({
                        orderId: order._id,
                        buyerId: buyer._id,
                        sellerId: worker._id,
                        gigId: gig._id,
                        rating: rating,
                        comment: order.review
                    });
                    await review.save();
                }
            }
        }
        console.log(`✅ Created ${WORKER_COUNT} workers with gigs and order history.`);

        console.log('Seeding Completed Successfully! 🚀');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    }
};

seedData();
