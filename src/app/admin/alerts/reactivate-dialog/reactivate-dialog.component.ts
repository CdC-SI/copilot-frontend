import {Component, Inject} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

type DialogData = {current?: string | null}; // LocalDateTime string "YYYY-MM-DDTHH:mm:ss" (sans fuseau)

@Component({
	selector: 'zco-reactivate-alert-dialog',
	templateUrl: './reactivate-dialog.component.html',
	styleUrl: './reactivate-dialog.component.scss'
})
export class ReactivateDialogComponent {
	form: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		private readonly ref: MatDialogRef<ReactivateDialogComponent, string | null>,
		@Inject(MAT_DIALOG_DATA) public data: DialogData
	) {
		const now = new Date();
		const parsed = parseLocalDateTime(data?.current || undefined);
		const base = parsed && parsed.getTime() > now.getTime() ? parsed : addHours(now, 2);

		this.form = this.fb.group({
			date: [new Date(base.getFullYear(), base.getMonth(), base.getDate()), Validators.required],
			time: [`${pad2(base.getHours())}:${pad2(base.getMinutes())}`, [Validators.pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)]]
		});
	}

	cancel(): void {
		this.ref.close(null);
	}

	submit(): void {
		if (this.form.invalid) return;
		const v = this.form.value as {date: Date; time?: string};
		const iso = buildLocalDateTime(v.date, v.time);
		this.ref.close(iso); // renvoie une LocalDateTime string "YYYY-MM-DDTHH:mm:ss"
	}
}

/* ---- Helpers locaux ---- */
function pad2(n: number) {
	return String(n).padStart(2, '0');
}

function addHours(d: Date, hours: number): Date {
	const c = new Date(d);
	c.setHours(c.getHours() + hours, 0, 0, 0);
	return c;
}

/** Construit un LocalDateTime string SANS fuseau pour le backend (ex: 2025-10-16T23:59:00) */
function buildLocalDateTime(dateObj: Date, timeStr?: string): string {
	const d = new Date(dateObj);
	let hh = 23,
		mm = 59;
	if (timeStr && /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
		const [h, m] = timeStr.split(':').map(Number);
		hh = h;
		mm = m;
	}
	d.setHours(hh, mm, 0, 0);
	const yyyy = d.getFullYear();
	const MM = pad2(d.getMonth() + 1);
	const dd = pad2(d.getDate());
	const H = pad2(d.getHours());
	const M = pad2(d.getMinutes());
	const S = pad2(d.getSeconds());
	return `${yyyy}-${MM}-${dd}T${H}:${M}:${S}`;
}

/** Parse un LocalDateTime sans fuseau (YYYY-MM-DDTHH:mm[:ss]) en Date locale */
function parseLocalDateTime(s?: string): Date | null {
	if (!s) return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
	if (!m) return null;
	const [, y, mo, d, h, mi, se] = m;
	return new Date(+y, +mo - 1, +d, +h, +mi, se ? +se : 0, 0);
}
