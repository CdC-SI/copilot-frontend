import {Injectable} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ActionId, ControlDef, ECONOMIC_BRANCHES_OPTIONS, FormDef} from '../model/form-definition';

@Injectable({
	providedIn: 'root'
})
export class DynamicFormService {
	private readonly catalog: FormDef[] = [
		{
			actionId: ActionId.II_CALCUL,
			cssClass: 'ii-calcul',
			messageTemplate:
				'Voici les informations nécessaires au calcul :<br>' +
				'1. Année d’éligibilité : {{yearOfEligibility}}<br>' +
				'2. Genre : {{gender}}<br>' +
				'3. Salaire effectif avant l’atteinte à la santé :<br>' +
				'		- Montant : {{preHealthEffectiveSalary}}<br>' +
				'		- Année du dernier salaire effectif : {{preHealthEffectiveYear}}<br>' +
				'4. Niveau de compétence avant l’atteinte à la santé : {{preHealthSkillLevel}}<br>' +
				'5. Branche économique avant l’atteinte à la santé : {{preHealthEconomicBranch}}<br>' +
				'6. Salaire effectif après l’atteinte à la santé :<br>' +
				'		- Montant : {{postHealthEffectiveSalary}}<br>' +
				'		- Année du dernier salaire effectif : {{postHealthEffectiveYear}}<br>' +
				'7. Niveau de compétence après l’atteinte à la santé : {{postHealthSkillLevel}}<br>' +
				'8. Branche économique après l’atteinte à la santé : {{postHealthEconomicBranch}}<br>' +
				'9. Taux d’activité avant l’atteinte à la santé : {{activityRate}}<br>' +
				'10. Réduction du taux d’activité après l’atteinte à la santé : {{reduction}}<br>' +
				'11. Autres déductions : {{deduction}}',
			sections: [
				{
					title: 'Informations générales',
					expanded: true,
					controls: [
						{
							key: 'yearOfEligibility',
							label: 'Année d’éligibilité',
							type: 'number',
							validators: [Validators.pattern('^[1-2][0-9]{3}$')],
							validationMessage: 'Année invalide (format AAAA).',
							parsePattern: /1\..*\s*:\s*(\d{4})/i
						},
						{
							key: 'gender',
							label: 'Genre',
							type: 'select',
							options: [
								{label: 'Homme', value: 'MALE'},
								{label: 'Femme', value: 'FEMALE'},
								{label: '26 al. 6 RAI', value: 'RAI'}
							],
							parsePattern: /(?:2\.\s*)?Genre\s*:\s*(?:\w+\s*)?\(?\s*(MALE|FEMALE|RAI)\s*\)?/i
						}
					]
				},
				{
					title: 'Avant atteinte à la santé',
					cssClass: 'block block--before',
					controls: [
						{
							key: 'preHealthEffectiveSalary',
							label: 'Salaire effectif (avant)',
							type: 'number',
							validators: [Validators.min(0)],
							validationMessage: 'Salaire effectif invalide.',
							parsePattern: /3\..*\s*:\s*([\d\s'’.,]+)/i
						},
						{
							key: 'preHealthEffectiveYear',
							label: 'Année dernier salaire (avant)',
							type: 'number',
							validators: [Validators.pattern('^[1-2][0-9]{3}$')],
							validationMessage: 'Année invalide (format AAAA).',
							parsePattern: /4\..*\s*:\s*(\d{4})/i
						},
						{
							key: 'preHealthSkillLevel',
							label: 'Niveau de compétence (avant)',
							type: 'number',
							validators: [Validators.min(1), Validators.max(4)],
							validationMessage: 'Niveau de compétence entre 1 et 4.',
							parsePattern: /5\..*\s*:\s*(\d)/i
						},
						{
							key: 'preHealthEconomicBranch',
							label: 'Branche économique (avant)',
							type: 'select',
							options: ECONOMIC_BRANCHES_OPTIONS,
							parsePattern: /6\..*\s*:\s*(.+)/i
						}
					]
				},
				{
					title: 'Après atteinte à la santé',
					cssClass: 'block block--after',
					controls: [
						{
							key: 'postHealthEffectiveSalary',
							label: 'Salaire effectif (après)',
							type: 'number',
							validators: [Validators.min(0)],
							validationMessage: 'Salaire effectif invalide.',
							parsePattern: /7\..*\s*:\s*([\d\s'’.,]+)/i
						},
						{
							key: 'postHealthEffectiveYear',
							label: 'Année dernier salaire (après)',
							type: 'number',
							validators: [Validators.pattern('^[1-2][0-9]{3}$')],
							validationMessage: 'Année invalide (format AAAA).',
							parsePattern: /8\..*\s*:\s*(\d{4})/i
						},
						{
							key: 'postHealthSkillLevel',
							label: 'Niveau de compétence (après)',
							type: 'number',
							validators: [Validators.min(1), Validators.max(4)],
							validationMessage: 'Niveau de compétence entre 1 et 4.',
							parsePattern: /9\..*\s*:\s*(\d)/i
						},
						{
							key: 'postHealthEconomicBranch',
							label: 'Branche économique (après)',
							type: 'select',
							options: ECONOMIC_BRANCHES_OPTIONS,
							parsePattern: /10\..*\s*:\s*(.+)/i
						}
					]
				},
				{
					title: 'Taux d’activité & déductions',
					controls: [
						{
							key: 'activityRate',
							label: 'Taux d’activité (avant)',
							type: 'number',
							validators: [Validators.min(0), Validators.max(100)],
							validationMessage: '% entre 0 et 100.',
							parsePattern: /11\..*\s*:\s*(\d{0,3})/i
						},
						{
							key: 'reduction',
							label: 'Réduction du taux (après)',
							type: 'number',
							validators: [Validators.min(0), Validators.max(100)],
							validationMessage: '% entre 0 et 100.',
							parsePattern: /12\..*\s*:\s*(\d{0,3})/i
						},
						{
							key: 'deduction',
							label: 'Autres déductions',
							type: 'number',
							validators: [Validators.min(0), Validators.max(100)],
							validationMessage: '% entre 0 et 100.',
							parsePattern: /13\..*\s*:\s*(\d{0,3})/i
						}
					]
				}
			]
		}
	];

	buildForm(action: ActionId): {def: FormDef; group: FormGroup} {
		const def = this.catalog.find(f => f.actionId === action);
		const group = new FormGroup({});

		const allControls: ControlDef[] = def.sections ? def.sections.flatMap(s => s.controls) : def.controls ?? [];
		allControls.forEach(c => group.addControl(c.key, new FormControl('', c.validators || [])));

		return {def, group};
	}

	hydrate(def: FormDef, raw: any): string {
		return def.messageTemplate.replace(/{{(.*?)}}/g, (_, k) => raw[k]);
	}

	parseAssistantMessage(def: FormDef, message: string): Partial<Record<string, any>> {
		const result: Record<string, any> = {};

		/* 1. Récupère tous les ControlDef (sections ou non) */
		const allControls = def.sections ? def.sections.flatMap(s => s.controls) : def.controls ?? [];

		/* 2. Boucle sur les contrôles munis d’un parsePattern */
		allControls.forEach(c => {
			if (!c.parsePattern) return;
			console.log('parsing', c.key, 'with pattern', c.parsePattern);
			const m = c.parsePattern.exec(message);
			if (!m) return;

			const raw = m[1].trim();

			/* 3. Post-traitement simple pour les nombres / monnaies */
			if (c.type === 'number') {
				result[c.key] = +raw.replace(/[\s'’_,]/g, '').replace(',', '.');
			} else {
				result[c.key] = raw;
			}
		});

		return result;
	}
}
