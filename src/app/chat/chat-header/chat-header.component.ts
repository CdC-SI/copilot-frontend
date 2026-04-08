import {Component, Input} from '@angular/core';

@Component({
	selector: 'zco-chat-header',
	templateUrl: './chat-header.component.html',
	styleUrls: ['./chat-header.component.scss'],
	standalone: false
})
export class ChatHeaderComponent {
	@Input() selectedWorkspace: string = '';
}
