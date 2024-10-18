export const ANCHOR_TAG_REGEX = /<a\s+href=['"]([^'"]+)['"][^>]*>(.*?)<\/a>/gi;

// Remove null, undefined and empty string value from object
export const clearNullAndEmpty = (obj: any): any => {
	return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== ''));
};
