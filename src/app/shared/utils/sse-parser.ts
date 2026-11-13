/**
 * Parser incrémental Server-Sent Events (https://html.spec.whatwg.org/multipage/server-sent-events.html).
 *
 * Écart volontaire à la spec : l'espace qui suit `data:` n'est PAS retiré. Spring écrit `data:<valeur>`
 * sans espace et les tokens LLM commencent souvent par un espace significatif (" mot").
 */
export class SseParser {
	private buffer = '';
	private dataLines: string[] = [];
	private hasData = false;

	/** Ajoute un fragment de texte décodé et renvoie les données des événements complets. */
	push(chunk: string): string[] {
		this.buffer += chunk;
		// Un `\r` final peut être la première moitié d'un `\r\n` : on attend le fragment suivant.
		const holdCr = this.buffer.endsWith('\r');
		const text = holdCr ? this.buffer.slice(0, -1) : this.buffer;
		const lines = text.split(/\r\n|\n|\r/);
		this.buffer = lines.pop() + (holdCr ? '\r' : '');

		const events: string[] = [];
		lines.forEach(line => this.processLine(line, events));
		return events;
	}

	/** Fin de flux : traite la dernière ligne incomplète et l'événement en cours. */
	flush(): string[] {
		const events: string[] = [];
		const rest = this.buffer.replace(/\r$/, '');
		this.buffer = '';
		if (rest) {
			this.processLine(rest, events);
		}
		this.dispatch(events);
		return events;
	}

	private processLine(line: string, events: string[]): void {
		if (line === '') {
			this.dispatch(events);
			return;
		}
		if (line.startsWith(':')) {
			return;
		}
		const colon = line.indexOf(':');
		const field = colon === -1 ? line : line.substring(0, colon);
		if (field === 'data') {
			this.dataLines.push(colon === -1 ? '' : line.substring(colon + 1));
			this.hasData = true;
		}
	}

	private dispatch(events: string[]): void {
		if (this.hasData) {
			const data = this.dataLines.join('\n');
			if (data !== '') {
				events.push(data);
			}
		}
		this.dataLines = [];
		this.hasData = false;
	}
}
