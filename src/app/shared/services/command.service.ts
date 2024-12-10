import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';

export interface Command {
	name: string;
	description: string;
	example: string;
}

@Injectable({
	providedIn: 'root'
})
export class CommandService {
	private readonly AUTHORIZED_COMMANDS: Command[] = [
		{name: '/summarize', description: 'Summarize text', example: '/summarize <text>'},
		{name: '/translate', description: 'Translate text', example: '/translate <text>'},
        {name: '/explain', description: 'Explain text', example: '/explain <text>'}
	];

	searchCommands(searchText: string): Observable<Command[]> {
		if (!searchText.startsWith('/')) {
			return of([]);
		}
		return of(
			this.AUTHORIZED_COMMANDS.filter(cmd =>
				cmd.name.toLowerCase().includes(searchText.toLowerCase())
			)
		);
	}

	isCommand(text: string): boolean {
		return text.startsWith('/');
	}

	parseCommand(text: string): {command: string; args: string} | null {
		if (!this.isCommand(text)) {
			return null;
		}
		const parts = text.split(' ');
		const command = parts[0];
		const args = parts.slice(1).join(' ').trim();
		return {command, args};
	}
}
