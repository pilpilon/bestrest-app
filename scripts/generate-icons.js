import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputImagePath = 'c:\\Users\\Aorus\\.gemini\\antigravity\\brain\\3911013e-e593-46c3-a87c-48a3f687ed64\\icon_cloche_1772103930352.png';
const publicDir = 'c:\\Users\\Aorus\\Documents\\restaurant\\public';

async function generateIcons() {
  try {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // 192x192 PWA Icon
    await sharp(inputImagePath)
      .resize(192, 192)
      .toFile(path.join(publicDir, 'pwa-192x192.png'));
    console.log('Generated pwa-192x192.png');

    // 512x512 PWA Icon
    await sharp(inputImagePath)
      .resize(512, 512)
      .toFile(path.join(publicDir, 'pwa-512x512.png'));
    console.log('Generated pwa-512x512.png');

    // 180x180 Apple Touch Icon
    await sharp(inputImagePath)
      .resize(180, 180)
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('Generated apple-touch-icon.png');

    // Generate a favicon.ico using a small png or png format.
    // For simplicity, generate a 64x64 favicon.png
    await sharp(inputImagePath)
      .resize(64, 64)
      .toFile(path.join(publicDir, 'favicon.png'));
    console.log('Generated favicon.png');

  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
