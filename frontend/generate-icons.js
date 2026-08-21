import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resDir = path.join(__dirname, 'android/app/src/main/res');

const squareSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d6a3e" />
      <stop offset="100%" stop-color="#183e24" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#greenGrad)" />
  <g transform="translate(116, 116) scale(11.66)" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-13" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </g>
</svg>
`;

const roundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d6a3e" />
      <stop offset="100%" stop-color="#183e24" />
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#greenGrad)" />
  <g transform="translate(116, 116) scale(11.66)" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-13" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </g>
</svg>
`;

const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <g transform="translate(116, 116) scale(8.33)" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-13" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </g>
</svg>
`;

const sizes = [
  { dir: 'mipmap-mdpi', icon: 48, fg: 108 },
  { dir: 'mipmap-hdpi', icon: 72, fg: 162 },
  { dir: 'mipmap-xhdpi', icon: 96, fg: 216 },
  { dir: 'mipmap-xxhdpi', icon: 144, fg: 324 },
  { dir: 'mipmap-xxxhdpi', icon: 192, fg: 432 },
];

async function generate() {
  for (const s of sizes) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png
    await sharp(Buffer.from(squareSvg))
      .resize(s.icon, s.icon)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(Buffer.from(roundSvg))
      .resize(s.icon, s.icon)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    await sharp(Buffer.from(foregroundSvg))
      .resize(s.fg, s.fg)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${s.dir} (icon: ${s.icon}x${s.icon}, fg: ${s.fg}x${s.fg})`);
  }

  // Also save public favicon / app-icon in frontend/public
  const publicDir = path.join(__dirname, 'public');
  await sharp(Buffer.from(squareSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'app-icon.png'));

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
