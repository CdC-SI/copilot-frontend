/** Événement Server-Sent Events : nom (`message` par défaut) et données. */
export interface SseEvent {
	event: string;
	data: string;
}

/**
 * Parser incrémental Server-Sent Events (https://html.spec.whatwg.org/multipage/server-sent-events.html).
 *
 * Écart volontaire à la spec : l'espace qui suit `data:` n'est PAS retiré. Spring écrit `data:<valeur>`
 * sans espace et une donnée peut commencer par un espace significatif.
 */
export class SseParser {
	private buffer = '';
	private dataLines: string[] = [];
	private hasData = false;
	private eventName = '';

	/** Ajoute un fragment de texte décodé et renvoie les événements complets. */
	push(chunk: string): SseEvent[] {
		this.buffer += chunk;
		// Un `\r` final peut être la première moitié d'un `\r\n` : on attend le fragment suivant.
		const holdCr = this.buffer.endsWith('\r');
		const text = holdCr ? this.buffer.slice(0, -1) : this.buffer;
		const lines = text.split(/\r\n|\n|\r/);
		this.buffer = lines.pop() + (holdCr ? '\r' : '');

		const events: SseEvent[] = [];
		lines.forEach(line => this.processLine(line, events));
		return events;
	}

	/** Fin de flux : traite la dernière ligne incomplète et l'événement en cours. */
	flush(): SseEvent[] {
		const events: SseEvent[] = [];
		const rest = this.buffer.replace(/\r$/, '');
		this.buffer = '';
		if (rest) {
			this.processLine(rest, events);
		}
		this.dispatch(events);
		return events;
	}

	private processLine(line: string, events: SseEvent[]): void {
		if (line === '') {
			this.dispatch(events);
			return;
		}
		if (line.startsWith(':')) {
			return;
		}
		const colon = line.indexOf(':');
		const field = colon === -1 ? line : line.substring(0, colon);
		const value = colon === -1 ? '' : line.substring(colon + 1);
		if (field === 'data') {
			this.dataLines.push(value);
			this.hasData = true;
		} else if (field === 'event') {
			this.eventName = value.startsWith(' ') ? value.substring(1) : value;
		}
	}

	private dispatch(events: SseEvent[]): void {
		if (this.hasData) {
			const data = this.dataLines.join('\n');
			if (data !== '') {
				events.push({event: this.eventName || 'message', data});
			}
		}
		this.dataLines = [];
		this.hasData = false;
		this.eventName = '';
	}
}
