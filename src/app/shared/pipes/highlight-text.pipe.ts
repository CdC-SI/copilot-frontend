import {Injectable, Pipe, PipeTransform} from '@angular/core';

@Pipe({
	name: 'highlightText'
})
@Injectable({
	providedIn: 'root'
})
export class HighlightTextPipe implements PipeTransform {
	/*
	 * Pipe used to highlight text
	 * It sets a span with the class ut-highlight-text surrounding the text to highlight
	 */
	transform(originalText: string, textToHighligh: string): string {
		const highlightedText = originalText.replace(new RegExp(textToHighligh, 'gi'), str => `<span class="zco-highlight-text">${str}</span>`);
		return `<span>${highlightedText}</span>`;
	}
}
