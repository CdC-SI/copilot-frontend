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

	/**
	 * Bouton icône d'une ligne (`pencil`, `delete`…). Ces boutons n'ont qu'une infobulle (description), sans nom
	 * accessible : ils sont localisés par leur icône (voir `admin-workspaces.spec.ts`).
	 */
	rowAction(row: Locator, icon: string): Locator {
		return row.getByRole('button').filter({has: this.page.locator(`mat-icon[svgicon="${icon}"]`)});
	}
}
