import {Component} from '@angular/core';

/** A help illustration (example image). */
interface HelpImage {
	titleKey: string;
	descriptionKey?: string;
	src: string;
}

/** A help tutorial video. Reserved for future use. */
interface HelpVideo {
	titleKey: string;
	descriptionKey?: string;
	src: string;
	thumbnail?: string;
}

/** A downloadable explanatory document. */
interface HelpDocument {
	titleKey: string;
	descriptionKey?: string;
	src: string;
	fileName: string;
}

@Component({
	selector: 'zco-tips',
	templateUrl: './tips.component.html',
	styleUrls: ['./tips.component.scss']
})
export class TipsComponent {
	images: HelpImage[] = [
		{
			titleKey: 'tips.items.read_answer.title',
			descriptionKey: 'tips.items.read_answer.description',
			src: 'assets/images/ZIA-CommentLireReponse.png'
		}
	];

	videos: HelpVideo[] = [];

	documents: HelpDocument[] = [
		{
			titleKey: 'tips.items.formation_initiale.title',
			descriptionKey: 'tips.items.formation_initiale.description',
			src: 'assets/docs/P-ZIA-FormationInitiale-v2.pdf',
			fileName: 'P-ZIA-FormationInitiale-v2.pdf'
		}
	];

	selectedImage: HelpImage | null = null;

	openImage(image: HelpImage): void {
		this.selectedImage = image;
	}

	closeImage(): void {
		this.selectedImage = null;
	}

	downloadDocument(doc: HelpDocument): void {
		const a = document.createElement('a');
		a.href = doc.src;
		a.download = doc.fileName;
		a.target = '_blank';
		a.rel = 'noopener';
		a.click();
	}

	playVideoFullscreen(event: Event): void {
		const card = event.currentTarget as HTMLElement;
		const video = card.querySelector('video') as HTMLVideoElement | null;
		if (video) {
			video.play().catch(() => {});
			video.requestFullscreen?.();
		}
	}
}
