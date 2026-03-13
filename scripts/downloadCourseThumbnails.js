import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // Get from https://unsplash.com/developers
const THUMBNAIL_DIR = path.join(__dirname, '../uploads/courses/thumbnails');
const USE_DEMO_MODE = true; // Set to false when you have an Unsplash API key

// Course categories with relevant search terms
const COURSE_TOPICS = [
  { category: 'web-development', search: 'web development programming', filename: 'web-development' },
  { category: 'mobile-development', search: 'mobile app development', filename: 'mobile-development' },
  { category: 'data-science', search: 'data science analytics', filename: 'data-science' },
  { category: 'machine-learning', search: 'artificial intelligence machine learning', filename: 'machine-learning' },
  { category: 'design', search: 'graphic design creative', filename: 'design' },
  { category: 'business', search: 'business management office', filename: 'business' },
  { category: 'marketing', search: 'digital marketing social media', filename: 'marketing' },
  { category: 'photography', search: 'photography camera', filename: 'photography' },
  { category: 'music', search: 'music production audio', filename: 'music' },
  { category: 'writing', search: 'writing content creative', filename: 'writing' },
  { category: 'finance', search: 'finance accounting investment', filename: 'finance' },
  { category: 'language', search: 'language learning education', filename: 'language' },
  { category: 'health-fitness', search: 'fitness health wellness', filename: 'health-fitness' },
  { category: 'cooking', search: 'cooking food culinary', filename: 'cooking' },
  { category: 'cloud-computing', search: 'cloud computing technology', filename: 'cloud-computing' },
  { category: 'cybersecurity', search: 'cybersecurity network security', filename: 'cybersecurity' },
  { category: 'ui-ux', search: 'ui ux design interface', filename: 'ui-ux' },
  { category: 'blockchain', search: 'blockchain cryptocurrency', filename: 'blockchain' },
  { category: 'game-development', search: 'game development gaming', filename: 'game-development' },
  { category: 'productivity', search: 'productivity workspace office', filename: 'productivity' }
];

// Demo images from Unsplash (no API key required)
const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&fit=crop', // Web development
  'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&fit=crop', // Mobile
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&fit=crop', // Data science
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&fit=crop', // AI/ML
  'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&fit=crop', // Design
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&fit=crop', // Business
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&fit=crop', // Marketing
  'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&fit=crop', // Photography
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&fit=crop', // Music
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&fit=crop', // Writing
  'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&fit=crop', // Finance
  'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&fit=crop', // Language
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&fit=crop', // Health & Fitness
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&fit=crop', // Cooking
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&fit=crop', // Cloud computing
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&fit=crop', // Cybersecurity
  'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&fit=crop', // UI/UX
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&fit=crop', // Blockchain
  'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&fit=crop', // Game development
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&fit=crop'  // Productivity
];

// Ensure thumbnails directory exists
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
};

// Download image from URL
const downloadImage = async (url, filepath) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
};

// Fetch image from Unsplash API
const fetchUnsplashImage = async (searchTerm) => {
  try {
    const response = await axios.get('https://api.unsplash.com/photos/random', {
      params: {
        query: searchTerm,
        orientation: 'landscape',
        w: 800,
        fit: 'crop'
      },
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    return response.data.urls.regular;
  } catch (error) {
    throw new Error(`Failed to fetch from Unsplash: ${error.message}`);
  }
};

// Main function
const downloadThumbnails = async () => {
  console.log('🚀 Starting Course Thumbnail Download Script...\n');

  // Ensure directory exists
  ensureDirectoryExists(THUMBNAIL_DIR);

  if (USE_DEMO_MODE) {
    console.log('📌 Running in DEMO mode (using predefined Unsplash URLs)');
    console.log('   To use Unsplash API, set USE_DEMO_MODE = false and add your API key\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < COURSE_TOPICS.length; i++) {
    const topic = COURSE_TOPICS[i];
    const filename = `${topic.filename}-${Date.now()}.jpg`;
    const filepath = path.join(THUMBNAIL_DIR, filename);

    try {
      console.log(`⏳ Downloading [${i + 1}/${COURSE_TOPICS.length}]: ${topic.category}...`);

      let imageUrl;
      
      if (USE_DEMO_MODE) {
        // Use predefined demo images
        imageUrl = DEMO_IMAGES[i];
      } else {
        // Fetch from Unsplash API
        imageUrl = await fetchUnsplashImage(topic.search);
        // Add a small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await downloadImage(imageUrl, filepath);
      console.log(`✅ Downloaded: ${filename}\n`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to download ${topic.category}: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Download Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Location: ${THUMBNAIL_DIR}`);
  console.log('='.repeat(50));
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Review downloaded images in:', THUMBNAIL_DIR);
  console.log('   2. Use these filenames in your course seeding scripts');
  console.log('   3. Consider getting an Unsplash API key for more variety');
  console.log('      Sign up at: https://unsplash.com/developers');
};

// Run the script
downloadThumbnails()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

