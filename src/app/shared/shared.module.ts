import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ObliqueModule} from '@oblique/oblique';
import {MaterialModule} from './material/material.module';
import {AutocompleteInputComponent} from './components/autocomplete-input/autocomplete-input.component';
import {TranslateModule, TranslatePipe} from '@ngx-translate/core';
import {HighlightTextPipe} from './pipes/highlight-text.pipe';

@NgModule({
	declarations: [AutocompleteInputComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, ObliqueModule, MaterialModule, TranslateModule],
	exports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, ObliqueModule, AutocompleteInputComponent, TranslateModule],
	providers: [TranslatePipe, HighlightTextPipe]
})
export class SharedModule {}
