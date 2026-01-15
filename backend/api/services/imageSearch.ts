/**
 * Image Search Service - Handles fallback image search via Unsplash API
 */

interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    full: string;
    thumb: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
    download_location: string;
  };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

/**
 * Helper function to search Unsplash API for images
 */
const searchUnsplash = async (searchTerm: string): Promise<UnsplashSearchResponse | null> => {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    throw new Error('UNSPLASH_ACCESS_KEY is not configured on the server.');
  }

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', searchTerm);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '15');
  url.searchParams.set('page', '1');

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
    });

    if (!response.ok) {
      console.error(`Unsplash API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return (await response.json()) as UnsplashSearchResponse;
  } catch (error) {
    console.error('Error calling Unsplash API:', error);
    return null;
  }
};

/**
 * Extract keywords from text by removing common stopwords
 */
const extractKeywords = (text: string): string[] => {
  const stopWords = new Set([
    'a', 'the', 'in', 'on', 'at', 'to', 'with', 'and', 'or', 'of', 'is', 'are',
    'walking', 'sitting', 'standing', 'alone', 'looking', 'watching', 'doing',
    'person', 'people', 'someone', 'man', 'woman', 'boy', 'girl'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 8);
};

/**
 * Find images from Unsplash based on visual description and style
 */
export const findImagesViaUnsplash = async (
  description: string,
  style?: string
): Promise<string | null> => {
  try {
    // Combine description and style for better search results
    const fullQuery = style ? `${description} ${style}` : description;
    const keywords = extractKeywords(fullQuery);

    // Fallback strategy with multiple query variations
    const queries = [
      keywords.join(' '), // Q1: Full keywords combined
      keywords.slice(0, 3).join(' '), // Q2: First few keywords
      keywords.length > 0 ? keywords[keywords.length - 1] : description, // Q3: Last keyword or original description
      description // Q4: Original description as fallback
    ];

    // Try each query until we find results
    for (const query of queries) {
      if (!query || query.trim().length === 0) continue;

      const result = await searchUnsplash(query);
      if (result && result.results && result.results.length > 0) {
        // Return the regular resolution image URL
        return result.results[0].urls.regular;
      }
    }

    return null;
  } catch (error) {
    console.error('Error in findImagesViaUnsplash:', error);
    return null;
  }
};
