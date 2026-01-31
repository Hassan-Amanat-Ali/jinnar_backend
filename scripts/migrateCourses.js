import mongoose from 'mongoose';
import Course from '../src/models/Course.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import { jinnarCoursesData } from '../../src/data/jinnarCourses.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// CONFIG
const MONGO_URI =  "mongodb+srv://jinnartanzania_app_user:iQhhxtCN05oULWDi@jinnar-platform.9bxo0jx.mongodb.net/?appName=Jinnar-Platform";
const UPLOAD_DIR = path.join(process.cwd(), 'backend/uploads/courses'); // Corrected to backend/uploads
const SOURCE_COURSES_DIR = path.join(process.cwd(), 'public/courses'); // Source is in root public/courses

// Ensure directories exist
const dirs = [
  path.join(UPLOAD_DIR, 'thumbnails'),
  path.join(UPLOAD_DIR, 'videos'),
  path.join(UPLOAD_DIR, 'materials')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function downloadImage(url, filename) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    
    const ext = path.extname(url).split('?')[0] || '.jpg';
    const finalFilename = `${filename}${ext}`;
    const savePath = path.join(UPLOAD_DIR, 'thumbnails', finalFilename);
    const writer = fs.createWriteStream(savePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(`/uploads/courses/thumbnails/${finalFilename}`));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading image for ${filename}:`, error.message);
    return null;
  }
}

async function copyCourseFile(sourceFilename) {
    // try exact match first
    let sourcePath = path.join(SOURCE_COURSES_DIR, sourceFilename);
    
    if (!fs.existsSync(sourcePath)) {
        console.warn(`File not found: ${sourcePath}`);
        // Try searching recursively or fuzzy matching if needed, but for now just warn
        return null;
    }

    // Determine destination
    const destFilename = `${Date.now()}-${sourceFilename}`;
    const destPath = path.join(UPLOAD_DIR, 'materials', destFilename);

    try {
        fs.copyFileSync(sourcePath, destPath);
        return `/uploads/courses/materials/${destFilename}`;
    } catch (err) {
        console.error(`Error copying file ${sourceFilename}:`, err.message);
        return null;
    }
}

async function startMigration() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    // 1. Find or Create Category
    let category = await Category.findOne({ name: "Education & Micro-Training" });
    if (!category) {
        console.log("Category 'Education & Micro-Training' not found, creating 'General Business'...");
        category = await Category.findOneAndUpdate(
            { name: "General Business" }, 
            { name: "General Business" }, 
            { upsert: true, new: true }
        );
    }
    console.log(`Using Category: ${category.name} (${category._id})`);

    // Clean up previous attempts
    // console.log("Cleaning up old courses...");
    // await Course.deleteMany({}); 

    // 2. Process Courses
    for (const courseData of jinnarCoursesData) {
        console.log(`Processing: ${courseData.title}`);

        // Check if exists
        let existingCourse = await Course.findOne({ title: courseData.title });
        
        // Handle Image
        let thumbnailUrl = "default-course.jpg";
        if (courseData.thumbnail) {
            // sanitize filename
            const cleanTitle = courseData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const downloaded = await downloadImage(courseData.thumbnail, cleanTitle);
            if (downloaded) thumbnailUrl = downloaded;
        }

        // Handle PDF/Doc
        let pdfUrl = "";
        if (courseData.fileName) {
            const copiedUrl = await copyCourseFile(courseData.fileName);
            if (copiedUrl) pdfUrl = copiedUrl;
        }

        // Determine Target Audience
        let targetAudience = "General";
        const lowerTitle = courseData.title.toLowerCase();
        if (lowerTitle.includes("employee") || 
            lowerTitle.includes("tier") || 
            lowerTitle.includes("worker") || 
            lowerTitle.includes("support") || 
            lowerTitle.includes("admin")) {
            targetAudience = "Employee";
        }

        // Create or Update Course
        const coursePayload = {
            title: courseData.title,
            description: courseData.description,
            category: category._id,
            instructor: new mongoose.Types.ObjectId("65bb7e742721092b3c220000"), // Placeholder matches schema
            courseType: 'pdf', 
            pdfUrl: pdfUrl,
            thumbnail: thumbnailUrl,
            level: 'Beginner',
            targetAudience: targetAudience, // Added field
            isPublished: true,
            published: true,
            totalOutlines: 0, 
            price: 0
        };

        const instructor = await mongoose.model('User').findOne(); 
        if (instructor) {
            coursePayload.instructor = instructor._id;
        }

        if (existingCourse) {
            // Update only if we have new files or force update
            if (pdfUrl) coursePayload.pdfUrl = pdfUrl;
            if (thumbnailUrl && thumbnailUrl !== "default-course.jpg") coursePayload.thumbnail = thumbnailUrl;
            coursePayload.targetAudience = targetAudience; // Always update audience

            await Course.updateOne({ _id: existingCourse._id }, coursePayload);
            console.log(` - Updated! ID: ${existingCourse._id} (Audience: ${targetAudience})`);
        } else {
            const newCourse = await Course.create(coursePayload);
            console.log(` - Created! ID: ${newCourse._id} (Audience: ${targetAudience})`);
        }
    }

    console.log("Migration Complete.");
    process.exit(0);

  } catch (error) {
    console.error("Migration Failed:", error);
    process.exit(1);
  }
}

startMigration();
