import {Routes} from '@angular/router';
import {ChatComponent} from './chat/chat.component';
import {AdminComponent} from './admin/admin.component';
import {TipsComponent} from './tips/tips.component';
import {AdminGuard} from './shared/services/admin.guard';
import {ToolsHomeComponent} from './tools/tools-home/tools-home.component';
import {CorpusComponent} from './corpus/corpus.component';
import {UserGuard} from './shared/services/user.guard';

export const routes: Routes = [
	{path: '', redirectTo: 'chat', pathMatch: 'full'},
	{path: 'chat', component: ChatComponent},
	{path: 'corpus', component: CorpusComponent, canActivate: [UserGuard]},
	{path: 'admin', component: AdminComponent, canActivate: [AdminGuard]},
	{path: 'tips', component: TipsComponent},
	{path: 'tools', component: ToolsHomeComponent}
];
