export const createImagePrompt = (description: string, style: string): string => {
  return `
    Cinematic 9:16 vertical photography. 
    Style: ${style}. 
    Subject: ${description}. 
    Atmospheric depth, professional lighting, photorealistic textures, 8k resolution. 
    No text, logos, or watermarks.
  `;
};
