// Regex volontairement non globales : utilisées avec .exec, un flag g partagerait l'état lastIndex entre appels.
// Les balises <type> (URL | FILE | BUSINESS_PROCESS) et <t> (titre) sont optionnelles (rétrocompatibilité).
export const ANCHOR_TAG_REGEX =
	/<source><id>(.*?)<\/id><url>(.*?)<\/url><file>(.*?)<\/file><pn>(.*?)<\/pn><sub>(.*?)<\/sub><v>(.*?)<\/v>(?:<type>(.*?)<\/type>)?(?:<t>(.*?)<\/t>)?<\/source>/i;
export const MESSAGE_ID_REGEX = /<message_uuid>(.*)<\/message_uuid>/i;
export const RETRIEVING_TAG_REGEX = /<retrieval>(.*?)<\/retrieval>/i;
export const TOPIC_CHECK_REGEX = /<topic_check>(.*?)<\/topic_check>/i;
export const OFF_TOPIC_REGEX = /<off_topic>(.*?)<\/off_topic>/i;
export const ROUTING_TAG_REGEX = /<routing>(.*?)<\/routing>/i;
export const INTENT_TAG_REGEX = /<intent_processing>(.*?)<\/intent_processing>/i;
export const SOURCE_TAG_REGEX = /<source_processing>(.*?)<\/source_processing>/i;
export const TAGS_TAG_REGEX = /<tags_processing>(.*?)<\/tags_processing>/i;
export const AGENT_TAG_REGEX = /<agent_handoff>(.*?)<\/agent_handoff>/i;
export const TOOL_TAG_REGEX = /<tool_use>(.*?)<\/tool_use>/i;
export const SUGGESTION_TAG_REGEX = /<suggestion>(.*?)<\/suggestion>/i;
export const OCR_TAG_REGEX = /<ocr>(.*?)<\/ocr>/i;
export const ATTACHMENT_TAG_REGEX = /<attachments>(.*?)<\/attachments>/i;
export const II_TARIFFS_TAG_REGEX = /<ii_tariffs>(.*?)<\/ii_tariffs>/i;
export const II_TARIFFS_ANSWER_TAG_REGEX = /<ii_tariffs_answer>(.*?)<\/ii_tariffs_answer>/i;
export const WORKSPACE_TAG_REGEX = /<workspace><name>(.*?)<\/name><\/workspace>/i;

// Remove null, undefined and empty string value from object
export const clearNullAndEmpty = <T extends object>(obj: T): T => {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== '')) as T;
};
