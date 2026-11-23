import {Locator, Page} from '@playwright/test';

/** Page objet du chat : sélecteurs par rôle et libellé accessibles (français, langue par défaut). */
export class ChatPage {
	readonly composer: Locator;
	readonly sendButton: Locator;
	/** Bouton « Arrêter la génération » du composeur, visible pendant la génération. */
	readonly stopButton: Locator;
	readonly sidebar: Locator;
	/** Fil des messages (questions et réponses). */
	readonly timeline: Locator;

	constructor(private readonly page: Page) {
		this.composer = page.getByRole('combobox', {name: /Posez une question/});
		this.sendButton = page.getByRole('button', {name: 'Envoyer'});
		this.stopButton = page.getByRole('button', {name: 'Arrêter la génération'});
		this.sidebar = page.getByRole('complementary', {name: 'Colonne gauche'});
		this.timeline = page.locator('zco-chat-timeline');
	}

	async open(): Promise<void> {
		await this.page.goto('/chat');
		await this.composer.waitFor();
	}

	async ask(question: string): Promise<void> {
		await this.composer.fill(question);
		await this.composer.press('Enter');
	}

	async openConversation(title: string): Promise<void> {
		await this.sidebar.getByText(title, {exact: true}).click();
	}
}
