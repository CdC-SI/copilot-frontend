export const ANCHOR_TAG_REGEX = /<source><url>(.*?)<\/url><file>(.*?)<\/file><pn>(.*?)<\/pn><sub>(.*?)<\/sub><v>(.*?)<\/v><\/source>/gi;
export const MESSAGE_ID_REGEX = /<message_uuid>(.*)<\/message_uuid>/gi;
export const RETRIEVING_TAG_REGEX = /<retrieval>(.*?)<\/retrieval>/gi;
export const TOPIC_CHECK_REGEX = /<topic_check>(.*?)<\/topic_check>/gi;
export const OFF_TOPIC_REGEX = /<off_topic>(.*?)<\/off_topic>/gi;
export const ROUTING_TAG_REGEX = /<routing>(.*?)<\/routing>/gi;
export const INTENT_TAG_REGEX = /<intent_processing>(.*?)<\/intent_processing>/gi;
export const SOURCE_TAG_REGEX = /<source_processing>(.*?)<\/source_processing>/gi;
export const TAGS_TAG_REGEX = /<tags_processing>(.*?)<\/tags_processing>/gi;
export const AGENT_TAG_REGEX = /<agent_handoff>(.*?)<\/agent_handoff>/gi;
export const TOOL_TAG_REGEX = /<tool_use>(.*?)<\/tool_use>/gi;
export const SUGGESTION_TAG_REGEX = /<suggestion>(.*?)<\/suggestion>/gi;

// Remove null, undefined and empty string value from object
export const clearNullAndEmpty = (obj: any): any => {
	return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== ''));
};
