import {TestBed} from '@angular/core/testing';
import {ActionId} from '../model/form-definition';
import {DynamicFormService} from './dynamic-form.service';

const ASSISTANT_MESSAGE = [
	'1. Année d’éligibilité : 2024',
	'2. Genre : Femme (FEMALE)',
	"3. Salaire effectif avant l’atteinte à la santé : 85'000",
	'4. Année du dernier salaire effectif : 2023',
	'5. Niveau de compétence avant : 2',
	'6. Branche économique avant : Commerce de détail',
	'7. Salaire effectif après : 42\u202f500',
	'8. Année du dernier salaire effectif : 2024',
	'9. Niveau de compétence après : 1',
	'10. Branche économique après : Santé',
	'11. Taux d’activité : 80',
	'12. Réduction : 20',
	'13. Autres déductions : 10'
].join('\n');

describe('DynamicFormService', () => {
	let service: DynamicFormService;

	beforeEach(() => {
		service = TestBed.inject(DynamicFormService);
	});

	it('construit le formulaire de calcul AI avec un contrôle par champ', () => {
		const {def, group} = service.buildForm(ActionId.II_CALCUL);

		expect(def.actionId).toBe(ActionId.II_CALCUL);
		expect(Object.keys(group.controls)).toHaveLength(13);
		expect(group.valid).toBe(true);
	});

	it('valide les champs selon leur définition', () => {
		const {group} = service.buildForm(ActionId.II_CALCUL);

		group.patchValue({yearOfEligibility: 24, preHealthSkillLevel: 5, activityRate: 120});

		expect(group.get('yearOfEligibility').invalid).toBe(true);
		expect(group.get('preHealthSkillLevel').invalid).toBe(true);
		expect(group.get('activityRate').invalid).toBe(true);
	});

	it('remplit le message à partir des valeurs saisies, vide pour les absentes', () => {
		const {def} = service.buildForm(ActionId.II_CALCUL);

		const message = service.hydrate(def, {yearOfEligibility: 2024, gender: 'MALE'});

		expect(message).toContain('1. Année d’éligibilité : 2024<br>');
		expect(message).toContain('2. Genre : MALE<br>');
		expect(message).not.toContain('{{');
		expect(message).toContain('11. Autres déductions : ');
	});

	it('extrait les valeurs d’une réponse de l’assistant (nombres normalisés, une valeur par ligne)', () => {
		const {def} = service.buildForm(ActionId.II_CALCUL);

		const values = service.parseAssistantMessage(def, ASSISTANT_MESSAGE);

		expect(values).toEqual({
			yearOfEligibility: 2024,
			gender: 'FEMALE',
			preHealthEffectiveSalary: 85000,
			preHealthEffectiveYear: 2023,
			preHealthSkillLevel: 2,
			preHealthEconomicBranch: 'Commerce de détail',
			postHealthEffectiveSalary: 42500,
			postHealthEffectiveYear: 2024,
			postHealthSkillLevel: 1,
			postHealthEconomicBranch: 'Santé',
			activityRate: 80,
			reduction: 20,
			deduction: 10
		});
	});

	it('ignore les champs absents de la réponse', () => {
		const {def} = service.buildForm(ActionId.II_CALCUL);

		expect(service.parseAssistantMessage(def, 'Aucune information.')).toEqual({});
	});

	it.each([
		['espace fine', '85\u2009000'],
		['espace insécable', '85\u00a0000'],
		['tabulation', '85\t000'],
		['espace', '85 000']
	])('accepte un montant séparé par une %s, sans déborder sur la ligne suivante', (_, amount) => {
		const {def} = service.buildForm(ActionId.II_CALCUL);

		const values = service.parseAssistantMessage(
			def,
			`3. Salaire effectif avant : ${amount}\n4. Année : 2023\n7. Salaire effectif après : ${amount}\n8. Année : 2024`
		);

		expect(values).toEqual(expect.objectContaining({preHealthEffectiveSalary: 85000, postHealthEffectiveSalary: 85000}));
	});

	it('accepte une définition sans sections', () => {
		const def = {actionId: ActionId.II_CALCUL, messageTemplate: '', controls: [{key: 'a', label: 'A', type: 'text' as const, parsePattern: /A\s*:\s*(.+)/}]};

		expect(service.parseAssistantMessage(def, 'A : valeur ')).toEqual({a: 'valeur'});
		expect(service.parseAssistantMessage({...def, controls: undefined}, 'A : valeur')).toEqual({});
	});
});
