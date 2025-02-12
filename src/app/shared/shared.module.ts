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
import {SignInComponent} from './components/sign-in/sign-in.component';
import {ChatHistoryComponent} from './components/chat-history/chat-history.component';
import {MatLine} from '@angular/material/core';
import { ActionSuggestionsComponent } from './components/action-suggestions/action-suggestions.component';

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
		SignInComponent,
		ChatHistoryComponent,
		ActionSuggestionsComponent
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
		MatLine
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
		ActionSuggestionsComponent
	],
	providers: [TranslatePipe, HighlightTextPipe]
})
export class SharedModule {}
