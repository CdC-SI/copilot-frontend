import {Locator, Page} from '@playwright/test';

/** Fichier choisi dans le sélecteur de pièces jointes. */
export interface AttachmentFile {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

/** Page objet du chat : sélecteurs par rôle et libellé accessibles (français, langue par défaut). */
export class ChatPage {
	readonly composer: Locator;
	readonly sendButton: Locator;
	/** Bouton « Arrêter la génération » du composeur, visible pendant la génération. */
	readonly stopButton: Locator;
	readonly sidebar: Locator;
	/** Fil des messages (questions et réponses). */
	readonly timeline: Locator;
	/** Questions de l'utilisateur, dans l'ordre du fil. */
	readonly questions: Locator;
	/** Réponses de l'assistant, dans l'ordre du fil. */
	readonly answers: Locator;
	/** Bouton « Régénérer la réponse » (dernière réponse terminée). */
	readonly regenerateButton: Locator;
	/** Pièces jointes de la conversation, au-dessus de la saisie. */
	readonly attachments: Locator;
	/** Notifications Oblique (succès, erreur, avertissement). */
	readonly notifications: Locator;

	constructor(private readonly page: Page) {
		this.composer = page.getByRole('combobox', {name: /Posez une question/});
		this.sendButton = page.getByRole('button', {name: 'Envoyer'});
		this.stopButton = page.getByRole('button', {name: 'Arrêter la génération'});
		this.sidebar = page.getByRole('complementary', {name: 'Colonne gauche'});
		this.timeline = page.locator('zco-chat-timeline');
		this.questions = this.timeline.locator('.message.user');
		this.answers = this.timeline.locator('.message.assistant');
		// Bouton de la réponse en erreur ou interrompue sans enregistrement, sinon icône de la barre d'actions. Celle-ci
		// est masquée aux technologies d'assistance (`mat-icon` ajoute `aria-hidden="true"`) : les éléments masqués
		// sont inclus puis filtrés sur la visibilité (cf. test.fixme « barre d'actions accessible »).
		this.regenerateButton = this.timeline.getByRole('button', {name: 'Régénérer la réponse', includeHidden: true}).filter({visible: true});
		this.attachments = page.locator('zco-chat-composer zco-chat-attachments mat-chip');
		this.notifications = page.locator('ob-notification');
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

	/** Étapes d'outils d'une réponse (liste, résumé repliable et cartes d'approbation). */
	toolSteps(answer: Locator): Locator {
		return answer.getByRole('group', {name: 'Étapes de recherche de l’assistant'});
	}

	/** Modifie la dernière question (bouton crayon, saisie, Entrée). */
	async editLastQuestion(text: string): Promise<void> {
		const question = this.questions.last();
		await question.hover();
		await question.getByRole('button', {name: 'Modifier la question'}).click();
		const input = question.getByRole('textbox', {name: 'Modifier la question'});
		await input.fill(text);
		await input.press('Enter');
	}

	/** Ajoute des pièces jointes par le bouton du composeur (sélecteur de fichiers). */
	async attach(...files: AttachmentFile[]): Promise<void> {
		const chooser = this.page.waitForEvent('filechooser');
		await this.page.getByRole('button', {name: 'Ajouter des pièces jointes'}).click();
		await (await chooser).setFiles(files);
	}
}
