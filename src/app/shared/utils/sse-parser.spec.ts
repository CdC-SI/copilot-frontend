import {SseParser} from './sse-parser';

describe('SseParser', () => {
	let parser: SseParser;

	const data = (chunk: string) => parser.push(chunk).map(e => e.data);

	beforeEach(() => {
		parser = new SseParser();
	});

	it('émet les données des événements complets', () => {
		expect(data('data:Bonjour\n\ndata: monde\n\n')).toEqual(['Bonjour', ' monde']);
	});

	it("conserve l'espace qui suit data: (tokens Spring)", () => {
		expect(data('data: mot\n\n')).toEqual([' mot']);
	});

	it('reconstitue un événement découpé entre plusieurs fragments', () => {
		expect(data('da')).toEqual([]);
		expect(data('ta:abc')).toEqual([]);
		expect(data('\n')).toEqual([]);
		expect(data('\n')).toEqual(['abc']);
	});

	it('joint les lignes data multiples par un saut de ligne', () => {
		expect(data('data:ligne 1\ndata:ligne 2\n\n')).toEqual(['ligne 1\nligne 2']);
		expect(data('data:\ndata:\n\n')).toEqual(['\n']);
	});

	it('accepte les fins de ligne \\r\\n et \\r, y compris coupées entre deux fragments', () => {
		expect(data('data:a\r\n\r\ndata:b\r\rdata:c\r')).toEqual(['a', 'b']);
		expect(data('\n\r\n')).toEqual(['c']);
	});

	it('ignore les commentaires, les champs inconnus et les événements vides', () => {
		expect(data(': keep-alive\n\nevent:message\nid:1\n\ndata:\n\ndata:x\n\n')).toEqual(['x']);
	});

	it("associe le nom d'événement à ses données, `message` par défaut, réinitialisé après chaque événement", () => {
		expect(parser.push('event:start\ndata:{"a":1}\n\nevent: text_delta\ndata:{}\n\ndata:x\n\n')).toEqual([
			{event: 'start', data: '{"a":1}'},
			{event: 'text_delta', data: '{}'},
			{event: 'message', data: 'x'}
		]);
	});

	it("conserve le nom d'événement découpé entre plusieurs fragments", () => {
		expect(parser.push('event:do')).toEqual([]);
		expect(parser.push('ne\ndata:{}\n')).toEqual([]);
		expect(parser.push('\n')).toEqual([{event: 'done', data: '{}'}]);
	});

	it('flush émet le dernier événement non terminé en fin de flux', () => {
		expect(data('event:done\ndata:fin')).toEqual([]);
		expect(parser.flush()).toEqual([{event: 'done', data: 'fin'}]);
		expect(parser.flush()).toEqual([]);
	});
});
