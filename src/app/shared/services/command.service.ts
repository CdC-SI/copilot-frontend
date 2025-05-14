import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {SettingsService} from './settings.service';
import {SettingsType} from '../model/settings';
import {AuthenticationServiceV2} from './auth.service';

export interface Command {
	name: string;
	description: string;
	example: string;
}

@Injectable({
	providedIn: 'root'
})
export class CommandService {
	private AUTHORIZED_COMMANDS: Command[] = [];

	constructor(
		private readonly settingsService: SettingsService,
		private readonly authService: AuthenticationServiceV2
	) {
		this.authService.$authenticatedUser.subscribe(user => {
			if (user) {
				this.settingsService.getSettings(SettingsType.AUTHORIZED_COMMANDS).subscribe(commands => {
					this.AUTHORIZED_COMMANDS = commands.map(cmd => ({
						name: cmd,
						description: `Execute ${cmd} command`,
						example: `${cmd} <text>`
					}));
				});
			}
		});
	}

	searchCommands(searchText: string): Observable<Command[]> {
		if (!searchText.startsWith('/')) {
			return of([]);
		}
		return of(this.AUTHORIZED_COMMANDS.filter(cmd => cmd.name.toLowerCase().includes(searchText.toLowerCase())));
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
