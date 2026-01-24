const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TEMPLATE_DIR = path.join(__dirname, '..', 'public', 'template kta');
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 760;

async function resizeTemplate(inputFile, outputFile) {
  const inputPath = path.join(TEMPLATE_DIR, inputFile);
  const outputPath = path.join(TEMPLATE_DIR, outputFile);

  console.log(`Resizing ${inputFile}...`);

  try {
    // Get original image info
    const metadata = await sharp(inputPath).metadata();
    console.log(`  Original: ${metadata.width}x${metadata.height}, ${metadata.format}, ${metadata.size} bytes`);

    // Resize with high quality
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover',
        position: 'center',
        kernel: sharp.kernel.lanczos3  // High quality resampling
      })
      .png({
        quality: 95,
        compressionLevel: 9
      })
      .toFile(outputPath);

    // Get new image info
    const newMetadata = await sharp(outputPath).metadata();
    const stats = fs.statSync(outputPath);

    console.log(`  Output: ${newMetadata.width}x${newMetadata.height}, ${newMetadata.format}, ${stats.size} bytes`);
    console.log(`  Saved to: ${outputFile}`);
    console.log(`  Success!`);
  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}

async function main() {
  console.log('=== KTA Template Resizer ===\n');

  // Check if PNG files exist
  const frontPng = path.join(TEMPLATE_DIR, 'KTA AI - FRONT.png');
  const backPng = path.join(TEMPLATE_DIR, 'KTA AI - BACK.png');

  if (!fs.existsSync(frontPng)) {
    console.log('Warning: KTA AI - FRONT.png not found');
    console.log('Please convert the SVG to PNG first using an online tool:\n');
    console.log('  https://cloudconvert.com/svg-to-png');
    console.log('  https://convertio.co/svg-png/');
    console.log('\nTarget resolution: 1200x760 pixels\n');
    return;
  }

  // Resize front template
  await resizeTemplate('KTA AI - FRONT.png', 'KTA AI - FRONT.png');

  console.log('');

  // Resize back template if it exists
  if (fs.existsSync(backPng)) {
    await resizeTemplate('KTA AI - BACK.png', 'KTA AI - BACK.png');
  } else {
    console.log('KTA AI - BACK.png not found, skipping...\n');
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
