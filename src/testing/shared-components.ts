import {ChangeDetectorRef, EnvironmentProviders, importProvidersFrom} from '@angular/core';
import {ComponentFixture} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {MatDialogRef} from '@angular/material/dialog';
import type {SourceDto} from '../app/shared/model/source';
import type {WorkspaceDto} from '../app/shared/model/workspace';

/** Icônes Material résolues sans registre SVG ni HTTP. */
export function provideTestIcons(): EnvironmentProviders {
	return importProvidersFrom(MatIconTestingModule);
}

/** `MatDialogRef` réduit à `close`, espionné. */
export function provideCloseableDialogRef(close: jest.Mock = jest.fn()): {provide: typeof MatDialogRef; useValue: {close: jest.Mock}} {
	return {provide: MatDialogRef, useValue: {close}};
}

/**
 * Détection après une mise à jour asynchrone d'un composant `Eager` qui ne marque pas sa vue : l'application s'appuie
 * sur zone.js pour relancer la détection, les tests Jest sont sans zone.
 */
export function detectAsyncChanges(fixture: ComponentFixture<unknown>): void {
	fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
	fixture.detectChanges();
}

export function aWorkspace(workspace: Partial<WorkspaceDto> = {}): WorkspaceDto {
	return {
		id: 1,
		name: 'retraite',
		description: 'Prévoyance vieillesse',
		hypotheticalQuestions: [],
		sources: ['avs', 'lpp'],
		createdAt: '2026-01-01T10:00:00',
		updatedAt: '2026-01-02T10:00:00',
		...workspace
	};
}

export function aSourceDetail(source: Partial<SourceDto> = {}): SourceDto {
	return {
		id: 1,
		name: 'avs',
		description: 'Assurance-vieillesse',
		hypotheticalQuestions: [],
		contents: [],
		createdAt: '2026-01-01T10:00:00',
		updatedAt: '2026-01-02T10:00:00',
		...source
	};
}
