import {Locator, Page} from '@playwright/test';

/** Page d'administration (`/admin`, réservée au rôle `ADMIN` : `backend.user = aUser({roles: ['ADMIN']})`). */
export class AdminPage {
	constructor(private readonly page: Page) {}

	async open(): Promise<void> {
		await this.page.goto('/admin');
		await this.page.locator('mat-expansion-panel-header').first().waitFor();
	}

	/** Déplie un panneau de l'accordéon (« Workspaces », « Sources »…), identifié par son titre. */
	async openPanel(title: string): Promise<Locator> {
		const header = this.page.getByRole('button', {name: new RegExp(`^${title}\\b`)});
		await header.click();
		return this.page.getByRole('region', {name: new RegExp(`^${title}\\b`)});
	}

	/** Ligne d'un tableau dont une cellule vaut exactement `text`. */
	row(table: Locator, text: string): Locator {
		return table.getByRole('row').filter({has: this.page.getByRole('cell', {name: text, exact: true})});
	}

	/** Boîte de dialogue, identifiée par son titre. */
	dialog(title: string): Locator {
		return this.page.getByRole('dialog', {name: title});
	}

	/** Bouton d'action d'une ligne, par son nom accessible « <verbe> <nom> » (`Modifier`, `Supprimer`). */
	rowAction(row: Locator, verb: 'Modifier' | 'Supprimer'): Locator {
		return row.getByRole('button', {name: new RegExp(`^${verb} `)});
	}
}
