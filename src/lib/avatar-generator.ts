// Simple hash function for generating deterministic avatars
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate colors based on hash
function generateColors(hash: number) {
  const colors = [
    '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#118AB2',
    '#073B4C', '#EF476F', '#FFD166', '#06D6A0', '#7209B7',
    '#F72585', '#4CC9F0', '#7209B7', '#F77F00', '#FCBF49'
  ];

  const bgColor = colors[hash % colors.length];
  const accentColor = colors[(hash + 7) % colors.length];

  return { bgColor, accentColor };
}

// Generate pirate-themed SVG avatar
export function generatePirateAvatar(workerName: string, size: number = 40): string {
  const hash = simpleHash(workerName);
  const { bgColor, accentColor } = generateColors(hash);

  // Generate pirate features based on hash
  const hasEyePatch = (hash % 3) === 0;
  const hasBandana = (hash % 4) === 0;
  const hasBeard = (hash % 5) === 0;
  const eyeType = hash % 2; // 0 = normal, 1 = wink

  let svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <!-- Background circle -->
      <circle cx="20" cy="20" r="20" fill="${bgColor}"/>

      <!-- Head (skin tone) -->
      <circle cx="20" cy="18" r="12" fill="#FFDBAC"/>
  `;

  // Bandana
  if (hasBandana) {
    svg += `
      <path d="M8 12 Q20 6 32 12 L32 8 Q20 2 8 8 Z" fill="${accentColor}"/>
      <circle cx="14" cy="10" r="1" fill="white"/>
      <circle cx="26" cy="10" r="1" fill="white"/>
    `;
  }

  // Eyes
  if (hasEyePatch) {
    svg += `
      <!-- Eye patch -->
      <ellipse cx="16" cy="16" rx="4" ry="3" fill="#2D3748"/>
      <path d="M12 13 Q8 10 4 12 Q8 14 12 19" stroke="#2D3748" stroke-width="2" fill="none"/>
      <!-- Good eye -->
      <circle cx="24" cy="16" r="2" fill="white"/>
      <circle cx="24" cy="16" r="1" fill="black"/>
    `;
  } else {
    if (eyeType === 0) {
      // Normal eyes
      svg += `
        <circle cx="16" cy="16" r="2" fill="white"/>
        <circle cx="16" cy="16" r="1" fill="black"/>
        <circle cx="24" cy="16" r="2" fill="white"/>
        <circle cx="24" cy="16" r="1" fill="black"/>
      `;
    } else {
      // Winking
      svg += `
        <path d="M14 16 Q16 14 18 16" stroke="black" stroke-width="1.5" fill="none"/>
        <circle cx="24" cy="16" r="2" fill="white"/>
        <circle cx="24" cy="16" r="1" fill="black"/>
      `;
    }
  }

  // Nose
  svg += `<circle cx="20" cy="19" r="0.5" fill="#E2B079"/>`;

  // Mouth (pirate grin)
  svg += `<path d="M16 22 Q20 25 24 22" stroke="black" stroke-width="1.5" fill="none"/>`;

  // Beard
  if (hasBeard) {
    svg += `
      <ellipse cx="20" cy="26" rx="6" ry="4" fill="#8B4513"/>
      <circle cx="18" cy="25" r="1" fill="#654321"/>
      <circle cx="22" cy="25" r="1" fill="#654321"/>
    `;
  }

  svg += `</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Generate a simpler geometric avatar if needed
export function generateGeometricAvatar(workerName: string, size: number = 40): string {
  const hash = simpleHash(workerName);
  const { bgColor, accentColor } = generateColors(hash);

  const shapes = ['rect', 'circle', 'polygon'];
  const shapeType = shapes[hash % shapes.length];
  const rotation = (hash % 4) * 90;

  let shapeElement = '';
  if (shapeType === 'rect') {
    shapeElement = `<rect x="12" y="12" width="16" height="16" fill="${accentColor}" transform="rotate(${rotation} 20 20)"/>`;
  } else if (shapeType === 'circle') {
    shapeElement = `<circle cx="20" cy="20" r="8" fill="${accentColor}"/>`;
  } else {
    shapeElement = `<polygon points="20,10 28,25 12,25" fill="${accentColor}" transform="rotate(${rotation} 20 20)"/>`;
  }

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="${bgColor}"/>
      ${shapeElement}
      <circle cx="20" cy="20" r="3" fill="white"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}