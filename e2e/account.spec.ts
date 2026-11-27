import {expect, test} from './support/mock-backend';
import {ChatPage} from './support/chat-page';
import {aUser} from '../src/testing/fixtures';
import {UserStatus} from '../src/app/shared/model/user';

/** Connexion sans compte ZIA (invité) ou via le Guest Login : dialogue d'information à l'ouverture, sans erreur. */
test.describe('Compte de l’utilisateur', () => {
	for (const [status, title] of [
		[UserStatus.GUEST, 'Vous êtes connecté en tant qu’invité'],
		[UserStatus.JOHN_DOE, 'Vous êtes connecté via le Guest Login']
	] as const) {
		test(`${status} : dialogue d’information à l’ouverture, puis page utilisable`, async ({page, backend}) => {
			backend.user = aUser({status, roles: []});
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			page.on('console', message => {
				if (message.type() === 'error') errors.push(message.text());
			});
			const chat = new ChatPage(page);

			// Le dialogue modal masque la page aux technologies d'assistance : pas de ChatPage.open (attend la saisie).
			await page.goto('/chat');

			const dialog = page.getByRole('dialog', {name: title});
			await expect(dialog).toBeVisible();
			await dialog.getByRole('button', {name: 'Continuer en tant qu’invité'}).click();

			await expect(dialog).toBeHidden();
			await expect(page.locator('.cdk-overlay-backdrop')).toHaveCount(0);
			await expect(page.locator('ob-alert, .ob-notification')).toHaveCount(0);
			await expect(chat.composer).toBeVisible();
			expect(errors).toEqual([]);
		});
	}
});
