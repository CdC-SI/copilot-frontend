import {findExcerptItems, normalizeForMatch} from './excerpt-match';

describe('excerpt-match', () => {
	describe('normalizeForMatch', () => {
		it('ignore casse, accents, ligatures, ponctuation et espaces', () => {
			expect(normalizeForMatch('Délai : 30 jours,\n**ﬁn**')).toBe('delai30joursfin');
		});

		it('accepte un texte absent', () => {
			expect(normalizeForMatch(undefined as unknown as string)).toBe('');
		});
	});

	describe('findExcerptItems', () => {
		const page = [
			'Chapitre 2',
			'Délais de recours',
			'Le recours doit être déposé dans un délai de',
			'30 jours dès la notification de la décision.',
			'Il est adressé au tribunal cantonal.',
			'Chapitre 3'
		];

		it('retient les fragments couverts par l’extrait, malgré une mise en forme différente', () => {
			const excerpt = '## Délais de recours\n\nLe recours doit être **déposé** dans un délai de 30 jours dès la notification de la décision.';

			expect(findExcerptItems(page, excerpt)).toEqual([1, 2, 3]);
		});

		it('retient les fragments retrouvés quand l’extrait déborde sur une autre page', () => {
			const excerpt = 'Il est adressé au tribunal cantonal. Texte de la page suivante qui ne figure pas ici.';

			expect(findExcerptItems(page, excerpt)).toEqual([4]);
		});

		it('ne retient rien si l’extrait est absent de la page', () => {
			expect(findExcerptItems(page, 'Un tout autre passage, sans rapport avec cette page.')).toEqual([]);
		});

		it('ne retient rien pour un extrait trop court ou une page sans couche texte', () => {
			expect(findExcerptItems(page, 'Chapitre')).toEqual([]);
			expect(findExcerptItems([], 'Le recours doit être déposé dans un délai de 30 jours')).toEqual([]);
			expect(findExcerptItems(['', ' '], 'Le recours doit être déposé dans un délai de 30 jours')).toEqual([]);
		});

		it('préfère l’occurrence qui suit la fenêtre précédente', () => {
			const repeated = ['dans un délai de trente jours', 'autre texte intermédiaire', 'le recours est déposé', 'dans un délai de trente jours'];

			expect(findExcerptItems(repeated, 'le recours est déposé dans un délai de trente jours')).toEqual([2, 3]);
		});
	});
});
