const sharp = require('sharp');

async function run() {
  const origPath = 'C:/Users/mo/.gemini/antigravity/brain/5e0c2ce9-34ca-43e2-a735-ceaa8b58ac41/fast_send_icon_1777001738293.png';

  // 1. Generate full bleed gradient by blurring heavily
  const bg = await sharp(origPath)
    .resize(16, 16)
    .resize(1024, 1024, { kernel: 'cubic' })
    .blur(100)
    .toBuffer();

  // 2. Create an SVG rounded rectangle mask that is slightly smaller than the white border
  // The original image has the inner gradient box at roughly x=177, y=169, width=670, height=685
  // We make a mask that is 650x660 with rx=120 to ensure NO white pixels get through.
  const svgMask = `
    <svg width="1024" height="1024">
      <rect x="185" y="180" width="650" height="660" rx="140" ry="140" fill="white" />
    </svg>
  `;

  // 3. Mask the original image
  const fg = await sharp(origPath)
    .composite([{
      input: Buffer.from(svgMask),
      blend: 'dest-in'
    }])
    .toBuffer();

  // 4. Composite the masked foreground over the blurred background
  // Then, crop to the bounding box of the gradient (e.g. center 700x700) and resize to 1024 so it's large
  const composite = await sharp(bg)
    .composite([{ input: fg }])
    .toBuffer();

  // Crop out any remaining edge pixels that might be outside the 700x700 center
  await sharp(composite)
    .extract({ left: 160, top: 160, width: 700, height: 700 })
    .resize(1024, 1024)
    .toFile('C:/Users/mo/.gemini/antigravity/brain/5e0c2ce9-34ca-43e2-a735-ceaa8b58ac41/fast_send_icon_perfect.png');
}
run().catch(console.error);
