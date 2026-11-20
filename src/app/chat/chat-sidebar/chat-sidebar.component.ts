import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card';
import {MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuTrigger} from '@angular/material/menu';
import {MatTooltip} from '@angular/material/tooltip';
import {TranslatePipe} from '@ngx-translate/core';
import {ObButtonDirective, ObIconButtonDirective} from '@oblique/oblique';
import {ChatHistoryComponent} from '../../shared/components/chat-history/chat-history.component';
import {ChatStore} from '../chat.store';

/** Colonne gauche : historique des conversations, nouvelles conversations (avec ou sans Corpus) et aide sur les modes. */
@Component({
	selector: 'zco-chat-sidebar',
	templateUrl: './chat-sidebar.component.html',
	styleUrl: './chat-sidebar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		MatCard,
		MatCardHeader,
		MatCardTitle,
		MatCardContent,
		MatIconButton,
		ObIconButtonDirective,
		ObButtonDirective,
		MatTooltip,
		MatIcon,
		MatMenuTrigger,
		MatMenu,
		ChatHistoryComponent,
		TranslatePipe
	]
})
export class ChatSidebarComponent {
	protected readonly store = inject(ChatStore);
}
