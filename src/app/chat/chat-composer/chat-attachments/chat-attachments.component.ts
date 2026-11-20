import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {MatButton} from '@angular/material/button';
import {MatChip, MatChipListbox, MatChipRemove} from '@angular/material/chips';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {Attachment} from '../../../shared/model/chat-history';
import {isRetryableUploadError, uploadErrorKey} from '../../../shared/utils/upload-error.utils';
import {ChatStore} from '../../chat.store';

/** Pièces jointes de la conversation : progression, échec, nouvel essai, suppression, téléchargement et délai dépassé. */
@Component({
	selector: 'zco-chat-attachments',
	templateUrl: './chat-attachments.component.html',
	styleUrl: './chat-attachments.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatChipListbox, MatChip, MatChipRemove, MatButton, MatIcon, DecimalPipe, TranslatePipe]
})
export class ChatAttachmentsComponent {
	protected readonly store = inject(ChatStore);

	canRetry(attachment: Attachment): boolean {
		return attachment.status === 'FAILED' && !!attachment.file && isRetryableUploadError(attachment.errorCode);
	}

	failureKey(attachment: Attachment): string {
		return attachment.errorCode ? uploadErrorKey(attachment.errorCode) : 'attachment.failed';
	}

	download(attachment: Attachment): void {
		if (attachment.status === 'PROCESSED') this.store.downloadAttachment(attachment);
	}
}
