import {Component, input, output} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {ObEUploadEventType, ObIUploadEvent} from '@oblique/oblique';
import {Observable, Subject, of} from 'rxjs';
import type {IMessageFeedback, ISourceFeedback} from '../app/shared/model/feedback';
import type {SourceDto} from '../app/shared/model/source';
import type {WorkspaceDto} from '../app/shared/model/workspace';

// ng2-charts dépend de lodash-es, publié en ESM seul et non transpilé par Jest : le module est remplacé pour les specs qui
// importent ce fichier AVANT tout composant à graphique (Chart.js n'a de toute façon pas de canvas sous jsdom).
jest.mock('ng2-charts', () => ({BaseChartDirective: class BaseChartDirective {}}));

/** Icônes de test (`provideTestIcons`) et rafraîchissement d'un composant `Eager` (`detectAsyncChanges`). */
export {detectAsyncChanges as refresh, provideTestIcons as provideFakeIcons} from './shared-components';

/**
 * Remplaçant de `ob-file-upload` (Oblique) : le vrai composant dépend du service d'upload et du DOM de glisser-déposer.
 * `choose(...files)` émet l'événement `CHOSEN` comme après une sélection de fichiers.
 */
@Component({selector: 'ob-file-upload', template: ''})
export class ObFileUploadStubComponent {
	readonly accept = input<string[]>([]);
	readonly maxFileSize = input<number>(0);
	readonly multiple = input<boolean>(true);
	readonly uploadEvent = output<ObIUploadEvent>();

	choose(...files: (File | string)[]): void {
		// Liste mixte autorisée pour vérifier que les composants ignorent les entrées qui ne sont pas des `File`.
		this.uploadEvent.emit({type: ObEUploadEventType.CHOSEN, files: files as File[]});
	}
}

/** `MatDialog` espionné : chaque `open` renvoie une modale dont `afterClosed` émet `result`. */
export interface DialogMock {
	open: jest.Mock;
	/** Résultat des prochaines fermetures. */
	result: unknown;
}

export function dialogMock(result?: unknown): DialogMock {
	const mock: DialogMock = {
		result,
		open: jest.fn(() => ({afterClosed: (): Observable<unknown> => of(mock.result)}))
	};
	return mock;
}

export function provideDialogMock(mock: DialogMock): {provide: typeof MatDialog; useValue: DialogMock} {
	return {provide: MatDialog, useValue: mock};
}

/** `MatDialogRef` espionné, avec fond et clavier pilotables. */
export interface DialogRefMock {
	close: jest.Mock;
	disableClose: boolean;
	backdrop: Subject<MouseEvent>;
	keydown: Subject<KeyboardEvent>;
	backdropClick: () => Observable<MouseEvent>;
	keydownEvents: () => Observable<KeyboardEvent>;
}

export function dialogRefMock(): DialogRefMock {
	const backdrop = new Subject<MouseEvent>();
	const keydown = new Subject<KeyboardEvent>();
	return {
		close: jest.fn(),
		disableClose: false,
		backdrop,
		keydown,
		backdropClick: () => backdrop.asObservable(),
		keydownEvents: () => keydown.asObservable()
	};
}

export function provideDialogRefMock(mock: DialogRefMock): {provide: typeof MatDialogRef; useValue: DialogRefMock} {
	return {provide: MatDialogRef, useValue: mock};
}

export function aSourceDto(source: Partial<SourceDto> = {}): SourceDto {
	return {
		id: 1,
		name: 'avs',
		description: 'Assurance-vieillesse',
		hypotheticalQuestions: ['Quand toucher la rente ?'],
		contents: [],
		createdAt: '2026-01-01T10:00:00',
		updatedAt: '2026-01-02T10:00:00',
		...source
	};
}

export function aWorkspaceDto(workspace: Partial<WorkspaceDto> = {}): WorkspaceDto {
	return {
		id: 1,
		name: 'retraite',
		description: 'Prévoyance vieillesse',
		hypotheticalQuestions: ['Comment calculer ma rente ?'],
		sources: ['avs', 'lpp'],
		createdAt: '2026-01-01T10:00:00',
		updatedAt: '2026-01-02T10:00:00',
		...workspace
	};
}

/** Feedback négatif (incomplet) sur une réponse. */
export function aMessageFeedback(feedback: Partial<IMessageFeedback> = {}): IMessageFeedback {
	return {
		id: 7,
		userUuid: 'u1',
		conversationUuid: 'c1',
		messageUuid: 'm1',
		score: -1,
		comment: 'Il manque la LPP',
		timestamp: '2026-01-15T10:00:00',
		status: 'NEW',
		category: 'INCOMPLETE_ANSWER',
		question: 'Quel est l’âge de la retraite ?',
		answer: 'L’âge de référence est de **65 ans**.',
		sources: [],
		...feedback
	};
}

/** Feedback négatif (mauvaise source) sur un document. */
export function aSourceFeedback(feedback: Partial<ISourceFeedback> = {}): ISourceFeedback {
	return {
		id: 11,
		userUuid: 'u1',
		conversationUuid: 'c1',
		messageUuid: 'm1',
		documentId: 'doc-1',
		feedbackType: 'NEGATIVE',
		comment: 'Directive obsolète',
		timestamp: '2026-01-15T10:00:00',
		status: 'NEW',
		category: 'WRONG_SOURCE',
		documentTitle: 'directive-avs.pdf',
		question: 'Quel est l’âge de la retraite ?',
		answer: '65 ans.',
		...feedback
	};
}

/** Fichier de `size` octets. */
export function aFile(name: string, size = 2048, type = 'application/pdf'): File {
	return new File([new Uint8Array(size)], name, {type});
}
