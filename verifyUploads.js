// verifyUploads.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3000/api/courses/upload'; // Adjust port if needed

// Ensure dummy files exist
const dummyDir = 'temp_verify';
if (!fs.existsSync(dummyDir)) {
    fs.mkdirSync(dummyDir);
}

const dummyImage = path.join(dummyDir, 'test_image.jpg');
const dummyVideo = path.join(dummyDir, 'test_video.mp4');
const dummyText = path.join(dummyDir, 'test_doc.txt');

// Create dummy files if not exist (just empty or text content)
if (!fs.existsSync(dummyImage)) fs.writeFileSync(dummyImage, 'fake image content'); // Might fail mime check if strict, but let's try or fetch real one? 
// Actually, strict mime check typically looks at magic numbers, so simple text might fail "image/" check.
// Let's rely on simple extension check or disable strict magic number check in middleware for now, 
// OR simply mocking the file object in unit test is better, but this is integration test.
// For true integration test with 'multer' checking mime-types, we need real files or at least correct headers/content.
// However, since we used req.file.mimetype which comes from browser/client usually, but multer reads it. 
// Multer's default behavior relies on the client's content-type header unless magic number check logic is added.
// In our middleware: `if (!file.mimetype.startsWith("image/"))` relies on what FormData sends.

// Let's create a minimal valid-ish files or just trust form-data sending right mimetype.

async function testUpload(endpoint, fieldName, filePath, contentType) {
    try {
        const form = new FormData();
        form.append(fieldName, fs.createReadStream(filePath), { contentType });

        console.log(`Testing upload to ${endpoint}...`);
        const response = await axios.post(`${BASE_URL}/${endpoint}`, form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        console.log(`✅ Success: ${endpoint}`, response.data);
    } catch (error) {
        if (error.response) {
            console.error(`❌ Failed: ${endpoint}`, error.response.status, error.response.data);
        } else {
            console.error(`❌ Failed: ${endpoint}`, error.message);
        }
    }
}

async function run() {
    // Create dummy files
    fs.writeFileSync(dummyImage, 'some image data');
    fs.writeFileSync(dummyVideo, 'some video data');
    fs.writeFileSync(dummyText, 'some text data');

    // Test Thumbnail
    await testUpload('thumbnail', 'thumbnail', dummyImage, 'image/jpeg');

    // Test Video
    await testUpload('video', 'video', dummyVideo, 'video/mp4');

    // Test Material
    await testUpload('material', 'material', dummyText, 'text/plain');

    // Cleanup
    // fs.rmSync(dummyDir, { recursive: true, force: true });
}

run();
