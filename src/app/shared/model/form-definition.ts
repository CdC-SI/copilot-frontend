import {ValidatorFn} from '@angular/forms';

/* 1️⃣ Types de base ----------------------------------------------------- */
export type ControlType = 'text' | 'number' | 'textarea' | 'date' | 'select';

export enum ActionId {
	II_CALCUL = 'II_CALCUL'
}

export interface SelectOption {
	value: string;
	label: string;
}

export interface ControlDef {
	key: string;
	label: string;
	type: ControlType;
	validators?: ValidatorFn[];
	validationMessage?: string; // message d'erreur personnalisé
	options?: SelectOption[]; // pour <select>
	extraClass?: string; // classe CSS éventuelle sur le champ
	parsePattern?: RegExp;
}

/* 2️⃣ Groupes logiques (sections) -------------------------------------- */
export interface FormSection {
	title?: string; // en-tête facultatif
	cssClass?: string; // wrapper stylable (ex.: 'block block--before')
	expanded?: boolean; // true ⇒ panneau ouvert par défaut
	controls: ControlDef[];
}

/* 3️⃣ Formulaire complet ----------------------------------------------- */
export interface FormDef {
	actionId: ActionId; // enum de vos actions/boutons
	messageTemplate: string; // texte à “hydrater”

	/* apparence globale du <form> */
	cssClass?: string;

	/*  ➡️ soit une liste plate… */
	controls?: ControlDef[];

	/*  ➡️ soit un découpage en sections */
	sections?: FormSection[];
}

export const ECONOMIC_BRANCHES_OPTIONS = [
	{value: '01-96', label: 'TOTAL'},
	{value: '01-03', label: 'SECTEUR PRIMAIRE'},
	{value: '05-43', label: 'SECTEUR SECONDAIRE'},
	{value: '05-09', label: 'Industries extractives'},
	{value: '10-33', label: 'Industrie manufacturière'},
	{value: '10-12', label: 'Industries alimentaires et du tabac'},
	{value: '13-15', label: 'Industries du textile et de l’habillement'},
	{value: '16-18', label: 'Industries du bois et du papier ; imprimerie'},
	{value: '19-20', label: 'Cokéfaction, raffinage et industrie chimique'},
	{value: '21', label: 'Industrie pharmaceutique'},
	{value: '22-23', label: 'Industries du caoutchouc et du plastique'},
	{value: '24-25', label: 'Fabrication de produits métalliques'},
	{value: '26', label: 'Fabrication de produits électroniques; horlogerie'},
	{value: '27', label: 'Fabrication d’équipements électriques'},
	{value: '28', label: 'Fabrication de machines et équipements n.c.a'},
	{value: '29-30', label: 'Fabrication de matériels de transport'},
	{value: '31-33', label: 'Autres industries manufacturières; rép. et inst.'},
	{value: '35', label: 'Production et distribution d’énergie'},
	{value: '36-39', label: 'Production et distr. d’eau; gestion des déchets'},
	{value: '41-43', label: 'Construction'},
	{value: '41-42', label: 'Construction de bâtiments et génie civil'},
	{value: '43', label: 'Travaux de construction spécialisés'},
	{value: '45-96', label: 'SECTEUR TERTIAIRE'},
	{value: '45-47', label: 'Commerce; réparation d’automobiles et de motocycles'},
	{value: '45', label: 'Commerce et rép. d’automobiles et de motocycles'},
	{value: '46', label: 'Commerce de gros'},
	{value: '47', label: 'Commerce de détail'},
	{value: '49-53', label: 'Transport et entreposage'},
	{value: '49', label: 'Transports terrestres et transport par conduites'},
	{value: '50-51', label: 'Transports par eau, transports aériens'},
	{value: '52', label: 'Entreposage et services auxiliaires des transports'},
	{value: '53', label: 'Activités de poste et de courrier'},
	{value: '55-56', label: 'Hébergement et restauration'},
	{value: '55', label: 'Hébergement'},
	{value: '56', label: 'Restauration'},
	{value: '58-63', label: 'Information et communication'},
	{value: '58-60', label: 'Édition, audiovisuel et diffusion'},
	{value: '61', label: 'Télécommunications'},
	{value: '62-63', label: 'Activités informatiques et services d’information'},
	{value: '64-66', label: 'Activités financières et d’assurance'},
	{value: '64', label: 'Activités des services financiers'},
	{value: '65', label: 'Assurance'},
	{value: '66', label: 'Activités aux. de services financiers et d’assurance'},
	{value: '68', label: 'Activités immobilières'},
	{value: '69-75', label: 'Activités spécialisées, scientifiques et techniques'},
	{value: '69', label: 'Activités juridiques et comptables'},
	{value: '70', label: 'Activités des sièges sociaux ; conseil de gestion'},
	{value: '71', label: 'Activités d’architecture et d’ingénierie'},
	{value: '72', label: 'Recherche-développement scientifique'},
	{value: '73-75', label: 'Autres activités spécialisées, scient. et techn.'},
	{value: '77-82', label: 'Activités de services administratifs et de soutien'},
	{value: '77+79-82', label: 'Activités de services administratifs (sans 78)'},
	{value: '78', label: 'Activités liées à l’emploi'},
	{value: '84', label: 'Administration publique'},
	{value: '85', label: 'Enseignement'},
	{value: '86-88', label: 'Santé humaine et action sociale'},
	{value: '86', label: 'Activités pour la santé humaine'},
	{value: '87', label: 'Hébergement médico-social et social'},
	{value: '88', label: 'Action sociale sans hébergement'},
	{value: '90-93', label: 'Arts, spectacles et activités récréatives'},
	{value: '94-96', label: 'Autres activités de services'}
];
