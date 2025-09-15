import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ObliqueModule} from '@oblique/oblique';
import {MaterialModule} from './material/material.module';
import {AutocompleteInputComponent} from './components/autocomplete-input/autocomplete-input.component';
import {TranslateModule, TranslatePipe} from '@ngx-translate/core';
import {HighlightTextPipe} from './pipes/highlight-text.pipe';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MarkdownModule} from 'ngx-markdown';
import {ConfirmDialogComponent} from './components/confirm-dialog/confirm-dialog.component';
import {ChatMessageComponent} from './components/chat-message/chat-message.component';
import {MessageActionComponent} from './components/message-action/message-action.component';
import {FaqItemEditComponent} from './components/faq-item-edit/faq-item-edit.component';
import {SignUpComponent} from './components/sign-up/sign-up.component';
import {ChatConfigurationEditComponent} from './components/chat-configuration-edit/chat-configuration-edit.component';
import {QuestionSuggestionComponent} from './components/question-suggestion/question-suggestion.component';
import {ChatHistoryComponent} from './components/chat-history/chat-history.component';
import {MatLine} from '@angular/material/core';
import {ActionSuggestionsComponent} from './components/action-suggestions/action-suggestions.component';
import {MatBadge} from '@angular/material/badge';
import {DynamicFormComponent} from './components/dynamic-form/dynamic-form.component';
import {SourceListComponent} from './components/source-list/source-list.component';
import {FilePreviewComponent} from './components/file-preview/file-preview.component';

@NgModule({
	declarations: [
		AutocompleteInputComponent,
		ConfirmDialogComponent,
		ChatMessageComponent,
		MessageActionComponent,
		FaqItemEditComponent,
		SignUpComponent,
		ChatConfigurationEditComponent,
		QuestionSuggestionComponent,
		ChatHistoryComponent,
		ActionSuggestionsComponent,
		DynamicFormComponent,
		SourceListComponent,
		FilePreviewComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		ObliqueModule,
		MaterialModule,
		TranslateModule,
		BrowserAnimationsModule,
		MarkdownModule.forRoot(),
		MatLine,
		MatBadge
	],
	exports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MaterialModule,
		ObliqueModule,
		AutocompleteInputComponent,
		TranslateModule,
		BrowserAnimationsModule,
		MarkdownModule,
		ConfirmDialogComponent,
		ChatMessageComponent,
		FaqItemEditComponent,
		ChatConfigurationEditComponent,
		QuestionSuggestionComponent,
		ChatHistoryComponent,
		ActionSuggestionsComponent,
		DynamicFormComponent,
		FilePreviewComponent
	],
	providers: [TranslatePipe, HighlightTextPipe]
})
export class SharedModule {}
