/** Longueur (caractères normalisés) des fenêtres de l'extrait recherchées dans la page. */
const WINDOW = 24;
/** Extrait trop court pour être repéré sans ambiguïté. */
const MIN_LENGTH = 12;

/**
 * Normalise un texte pour la comparaison entre l'extrait (texte du chunk, souvent en Markdown) et la couche texte
 * d'une page PDF : sans diacritiques ni ligatures, en minuscules, lettres et chiffres seulement (la ponctuation,
 * les espaces et la mise en forme diffèrent d'une extraction à l'autre).
 */
export function normalizeForMatch(text: string): string {
	return (text ?? '')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Indices des fragments de la couche texte d'une page (dans l'ordre de lecture) couverts par l'extrait cité.
 *
 * L'extrait normalisé est découpé en fenêtres chevauchantes, cherchées dans le texte normalisé de la page de
 * préférence après la fenêtre précédente : les fragments recouverts par une fenêtre trouvée sont retenus. Un extrait
 * absent de la page (page voisine, PDF scanné sans couche texte) ne retient rien.
 */
export function findExcerptItems(items: readonly string[], excerpt: string): number[] {
	const target = normalizeForMatch(excerpt);
	if (target.length < MIN_LENGTH) return [];

	let page = '';
	const owners: number[] = [];
	items.forEach((item, index) => {
		const text = normalizeForMatch(item);
		page += text;
		for (let i = 0; i < text.length; i++) owners.push(index);
	});
	if (page.length < MIN_LENGTH) return [];

	const window = Math.min(WINDOW, target.length);
	const step = Math.max(1, Math.floor(window / 2));
	const starts: number[] = [];
	for (let start = 0; start + window <= target.length; start += step) starts.push(start);
	if (starts.at(-1) !== target.length - window) starts.push(target.length - window);

	const covered = new Set<number>();
	let from = 0;
	for (const start of starts) {
		const piece = target.slice(start, start + window);
		let at = page.indexOf(piece, from);
		if (at < 0) at = page.indexOf(piece);
		if (at < 0) continue;
		for (let i = at; i < at + window; i++) covered.add(owners[i]);
		from = at;
	}
	return [...covered].sort((a, b) => a - b);
}
