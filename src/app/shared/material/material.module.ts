import {NgModule} from '@angular/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatButtonModule} from '@angular/material/button';
import {MatRadioModule} from '@angular/material/radio';
import {MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {MatMenuModule} from '@angular/material/menu';
import {MatOptionModule} from '@angular/material/core';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatTabsModule} from '@angular/material/tabs';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatListModule} from '@angular/material/list';
import {MatChipsModule} from '@angular/material/chips';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatSidenavModule} from '@angular/material/sidenav';
import { MatSlideToggleModule } from "@angular/material/slide-toggle";

@NgModule({
	imports: [
		MatCardModule,
		MatFormFieldModule,
		MatInputModule,
		MatIconModule,
		MatExpansionModule,
		MatButtonModule,
		MatRadioModule,
		MatTableModule,
		MatPaginatorModule,
		MatSortModule,
		MatMenuModule,
		MatOptionModule,
		MatSelectModule,
		MatTooltipModule,
		MatCheckboxModule,
		MatTabsModule,
		MatAutocompleteModule,
		MatListModule,
		MatChipsModule,
		MatDialogModule,
		MatSidenavModule,
		MatSlideToggleModule
	],
	exports: [
		MatButtonModule,
		MatCardModule,
		MatFormFieldModule,
		MatInputModule,
		MatIconModule,
		MatCheckboxModule,
		MatExpansionModule,
		MatRadioModule,
		MatTableModule,
		MatPaginatorModule,
		MatSortModule,
		MatDatepickerModule,
		MatMenuModule,
		MatOptionModule,
		MatSelectModule,
		MatTooltipModule,
		MatCheckboxModule,
		MatTabsModule,
		MatAutocompleteModule,
		MatListModule,
		MatChipsModule,
		MatDialogModule,
		MatSidenavModule,
		MatSlideToggleModule
	],
	providers: [
		{
			provide: MatDialogRef,
			useValue: {}
		}
	]
})
export class MaterialModule {}
