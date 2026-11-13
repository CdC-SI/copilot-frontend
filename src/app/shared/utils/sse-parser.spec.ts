import {SseParser} from './sse-parser';

describe('SseParser', () => {
	let parser: SseParser;

	beforeEach(() => {
		parser = new SseParser();
	});

	it('émet les données des événements complets', () => {
		expect(parser.push('data:Bonjour\n\ndata: monde\n\n')).toEqual(['Bonjour', ' monde']);
	});

	it("conserve l'espace qui suit data: (tokens Spring)", () => {
		expect(parser.push('data: mot\n\n')).toEqual([' mot']);
	});

	it('reconstitue un événement découpé entre plusieurs fragments', () => {
		expect(parser.push('da')).toEqual([]);
		expect(parser.push('ta:abc')).toEqual([]);
		expect(parser.push('\n')).toEqual([]);
		expect(parser.push('\n')).toEqual(['abc']);
	});

	it('joint les lignes data multiples par un saut de ligne', () => {
		expect(parser.push('data:ligne 1\ndata:ligne 2\n\n')).toEqual(['ligne 1\nligne 2']);
		expect(parser.push('data:\ndata:\n\n')).toEqual(['\n']);
	});

	it('accepte les fins de ligne \\r\\n et \\r, y compris coupées entre deux fragments', () => {
		expect(parser.push('data:a\r\n\r\ndata:b\r\rdata:c\r')).toEqual(['a', 'b']);
		expect(parser.push('\n\r\n')).toEqual(['c']);
	});

	it('ignore les commentaires, les autres champs et les événements vides', () => {
		expect(parser.push(': keep-alive\n\nevent:message\nid:1\n\ndata:\n\ndata:x\n\n')).toEqual(['x']);
	});

	it('flush émet le dernier événement non terminé en fin de flux', () => {
		expect(parser.push('data:fin')).toEqual([]);
		expect(parser.flush()).toEqual(['fin']);
		expect(parser.flush()).toEqual([]);
	});
});
