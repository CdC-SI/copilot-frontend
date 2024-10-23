import {Injectable} from '@angular/core';
import {ChatRequest} from '../model/rag';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class RagService {
	constructor(private readonly config: ConfigurationService) {}

	process(ragRequest: ChatRequest): Observable<string> {
		return new Observable<string>(observer => {
			fetch(this.config.backendApi('/conversations'), {
				method: 'POST',
				headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'},
				body: JSON.stringify(ragRequest)
			})
				.then(response => {
					const reader = response.body.getReader();
					const decoder = new TextDecoder('utf-8');
					const buffer = '';

					this.readStream(reader, decoder, buffer, observer);
				})
				.catch(error => {
					observer.error(error);
				});
		});
	}

	private readStream(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, buffer: string, observer: any) {
		reader
			.read()
			.then(({done, value}) => {
				if (done) {
					observer.complete();
					return;
				}

				buffer += decoder.decode(value, {stream: true});
				buffer = this.processBuffer(buffer, observer);
				this.readStream(reader, decoder, buffer, observer);
			})
			.catch(error => {
				observer.error(error);
			});
	}

	private processBuffer(buffer: string, observer: any) {
		const events = buffer.split('\n\n');
		buffer = events.pop()!; // Save incomplete event back to buffer
		events.forEach(event => {
			const parsedData = this.parseEvent(event);
			if (parsedData) {
				observer.next(parsedData);
			}
		});
		return buffer;
	}

	private parseEvent(eventString: string) {
		const lines = eventString.split('\n');
		let data = '';
		for (const line of lines) {
			if (line.startsWith('data:')) {
				data += lines.length > 1 ? `${line.substring(5)}\n` : `${line.substring(5)}`;
			}
		}
		return data;
	}
}
