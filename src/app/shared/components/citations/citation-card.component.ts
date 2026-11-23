import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {MessageSource} from '../../model/chat-history';
import {sourceLabel} from '../../utils/citations';

/** Aperçu d'une source citée, affiché au survol ou au focus d'une pastille de citation. */
@Component({
	selector: 'zco-citation-card',
	template: `
		<div class="citation-card" role="tooltip" [id]="cardId()">
			<div class="citation-card-title">
				<span class="citation-card-number">{{ n() }}</span>
				<span>{{ source() ? label(source()) : ('chat.citation.unknown' | translate: {n: n()}) }}</span>
			</div>
			@if (source(); as s) {
				@if (s.subsection || s.pageNumber || s.version) {
					<ul class="citation-card-meta">
						@if (s.subsection) {
							<li>{{ 'sourceList.meta.section' | translate }} : {{ s.subsection }}</li>
						}
						@if (s.pageNumber) {
							<li>{{ 'sourceList.meta.page' | translate }} : {{ s.pageNumber }}</li>
						}
						@if (s.version) {
							<li>{{ 'sourceList.meta.version' | translate }} : {{ s.version | translate }}</li>
						}
					</ul>
				}
				<p class="citation-card-hint">{{ 'chat.citation.hint' | translate }}</p>
			}
		</div>
	`,
	styles: `
		.citation-card {
			max-width: 22rem;
			padding: 0.5rem 0.75rem;
			border-radius: 0.375rem;
			background: #2f4356;
			color: #fff;
			font-size: 0.8125rem;
			line-height: 1.35;
			box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
		}
		.citation-card-title {
			display: flex;
			gap: 0.5rem;
			align-items: baseline;
			font-weight: 600;
			word-break: break-word;
		}
		.citation-card-number {
			flex: none;
			min-width: 1.25rem;
			padding: 0 0.3rem;
			border-radius: 0.625rem;
			background: rgb(255 255 255 / 20%);
			text-align: center;
		}
		.citation-card-meta {
			margin: 0.25rem 0 0;
			padding: 0;
			list-style: none;
		}
		.citation-card-hint {
			margin: 0.25rem 0 0;
			opacity: 0.8;
			font-style: italic;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe]
})
export class CitationCardComponent {
	readonly n = input.required<number>();
	readonly source = input<MessageSource>();
	readonly cardId = input('');

	protected label(source: MessageSource): string {
		return sourceLabel(source);
	}
}
