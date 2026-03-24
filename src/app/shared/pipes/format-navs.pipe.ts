import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
	name: 'formatNavs'
})
export class FormatNavsPipe implements PipeTransform {
	transform(value: string | null | undefined): string {
		if (!value) {
			return '';
		}
		const digits = value.replaceAll('.', '');
		if (digits.length !== 13) {
			return value;
		}
		return `${digits.substring(0, 3)}.${digits.substring(3, 7)}.${digits.substring(7, 11)}.${digits.substring(11, 13)}`;
	}
}
