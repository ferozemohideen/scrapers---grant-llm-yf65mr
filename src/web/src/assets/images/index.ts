/**
 * @fileoverview Central index file for managing and exporting image assets
 * @version 1.0.0
 * @requires react ^18.0.0
 */

// Define interface for responsive image sources
interface ResponsiveSources {
  mobile: string;   // <767px
  tablet: string;   // 768-1199px
  desktop: string;  // >1200px
  webp?: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}

// Define interface for image asset metadata
export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
  responsive: ResponsiveSources;
  loading: 'lazy' | 'eager';
  format: 'webp' | 'png' | 'jpg';
}

// Define breakpoints for responsive images
export const BREAKPOINTS = {
  mobile: 767,
  tablet: 1199,
  desktop: 1200,
} as const;

// Define CDN configuration
const CDN_CONFIG = {
  baseUrl: process.env.REACT_APP_CDN_URL || '',
  imageOptimization: {
    quality: 85,
    auto: 'format,compress',
  },
} as const;

// Define all image paths with their variants
export const IMAGE_PATHS = {
  logo: {
    default: '/images/logo.png',
    dark: '/images/logo-dark.png',
    mobile: '/images/logo-mobile.png',
  },
  auth: {
    login: '/images/login-bg.jpg',
    register: '/images/register-bg.jpg',
  },
  dashboard: {
    overview: '/images/dashboard-overview.png',
    analytics: '/images/dashboard-analytics.png',
  },
  placeholder: '/images/placeholder.png',
} as const;

/**
 * Returns the full CDN path for an image asset with optimization parameters
 * @param category - Image category from IMAGE_PATHS
 * @param name - Image name within the category
 * @param options - Optional optimization parameters
 * @returns Full CDN-ready image path
 */
export const getImagePath = (
  category: keyof typeof IMAGE_PATHS,
  name: string,
  options: Partial<typeof CDN_CONFIG.imageOptimization> = {}
): string => {
  // Validate category exists
  if (!(category in IMAGE_PATHS)) {
    throw new Error(`Invalid image category: ${category}`);
  }

  // Get category object
  const categoryObj = IMAGE_PATHS[category] as Record<string, string>;

  // Validate image name exists
  if (!(name in categoryObj)) {
    throw new Error(`Invalid image name: ${name} in category: ${category}`);
  }

  const imagePath = categoryObj[name];
  const cdnUrl = CDN_CONFIG.baseUrl;
  const optimizationParams = {
    ...CDN_CONFIG.imageOptimization,
    ...options,
  };

  // Construct query parameters for optimization
  const queryParams = new URLSearchParams(
    Object.entries(optimizationParams).map(([key, value]) => [key, String(value)])
  ).toString();

  return `${cdnUrl}${imagePath}${queryParams ? `?${queryParams}` : ''}`;
};

/**
 * Returns responsive image sources with WebP support and breakpoint optimization
 * @param imagePath - Base image path
 * @param breakpoints - Optional custom breakpoints
 * @returns Object containing optimized image sources for different breakpoints
 */
export const getResponsiveImageSrc = (
  imagePath: string,
  breakpoints: typeof BREAKPOINTS = BREAKPOINTS
): ResponsiveSources => {
  const generateSrcSet = (format: 'webp' | 'original' = 'original') => {
    const formatParam = format === 'webp' ? '&fmt=webp' : '';
    return {
      mobile: getImagePath('placeholder', imagePath, {
        width: breakpoints.mobile,
        ...CDN_CONFIG.imageOptimization,
      }) + formatParam,
      tablet: getImagePath('placeholder', imagePath, {
        width: breakpoints.tablet,
        ...CDN_CONFIG.imageOptimization,
      }) + formatParam,
      desktop: getImagePath('placeholder', imagePath, {
        width: breakpoints.desktop,
        ...CDN_CONFIG.imageOptimization,
      }) + formatParam,
    };
  };

  return {
    ...generateSrcSet('original'),
    webp: generateSrcSet('webp'),
  };
};

// Export common image assets with full metadata
export const commonImages: Record<string, ImageAsset> = {
  logo: {
    src: getImagePath('logo', 'default'),
    alt: 'Application Logo',
    width: 200,
    height: 60,
    responsive: getResponsiveImageSrc(IMAGE_PATHS.logo.default),
    loading: 'eager',
    format: 'png',
  },
  loginBackground: {
    src: getImagePath('auth', 'login'),
    alt: 'Login Page Background',
    width: 1920,
    height: 1080,
    responsive: getResponsiveImageSrc(IMAGE_PATHS.auth.login),
    loading: 'lazy',
    format: 'jpg',
  },
  dashboardOverview: {
    src: getImagePath('dashboard', 'overview'),
    alt: 'Dashboard Overview Illustration',
    width: 1200,
    height: 800,
    responsive: getResponsiveImageSrc(IMAGE_PATHS.dashboard.overview),
    loading: 'lazy',
    format: 'png',
  },
  placeholder: {
    src: getImagePath('placeholder', 'placeholder'),
    alt: 'Content Loading Placeholder',
    width: 100,
    height: 100,
    responsive: getResponsiveImageSrc(IMAGE_PATHS.placeholder),
    loading: 'eager',
    format: 'png',
  },
};

// Export type for image categories
export type ImageCategory = keyof typeof IMAGE_PATHS;

// Export type for common image keys
export type CommonImageKey = keyof typeof commonImages;