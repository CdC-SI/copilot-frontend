import {Injectable} from '@angular/core';
import {ChatRequest} from '../model/rag';
import {ConfigurationService} from '../../core/app-configuration/configuration.service';
import {Observable} from 'rxjs';
import {AuthenticationServiceV2} from './auth.service';
import {EnvironmentService} from 'zas-design-system';

@Injectable({
	providedIn: 'root'
})
export class RagService {
	constructor(
		private readonly config: ConfigurationService,
		private readonly authService: AuthenticationServiceV2,
		private readonly environmentService: EnvironmentService
	) {}

	process(ragRequest: ChatRequest): Observable<string> {
		const headers = new Headers({'Content-Type': 'application/json', Accept: 'text/event-stream'});
		const token = this.environmentService.getIsLocalhostEnvironment() ? this.environmentService.getMockToken() : this.authService.jwtToken;

		if (token) {
			headers.append('Blue', `Bearer ${token}`);
		}
		return new Observable<string>(observer => {
			fetch(this.config.backendApi('/conversations'), {
				method: 'POST',
				headers,
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
		lines.forEach((line, index) => {
			if (line.startsWith('data:')) {
				data += `${line.substring(5)}`;
			}
			if (index < lines.length - 1) {
				data += '\n';
			}
		});
		return data;
	}
}
