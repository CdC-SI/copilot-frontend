export const ANCHOR_TAG_REGEX = /<source><a\s+href=['"]([^'"]+)['"][^>]*>(.*?)<\/a><\/source>/gi;
export const MESSAGE_ID_REGEX = /<message_uuid>(.*)<\/message_uuid>/gi;

// Remove null, undefined and empty string value from object
export const clearNullAndEmpty = (obj: any): any => {
	return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== ''));
};
