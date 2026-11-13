// Remove null, undefined and empty string value from object
export const clearNullAndEmpty = <T extends object>(obj: T): T => {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== '')) as T;
};
