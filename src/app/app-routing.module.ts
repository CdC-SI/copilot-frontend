import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ChatComponent} from './chat/chat.component';
import {AdminComponent} from './admin/admin.component';
import {TipsComponent} from './tips/tips.component';
import {AdminGuard} from './shared/services/admin.guard';
import {ToolsHomeComponent} from './tools/tools-home/tools-home.component';
import {PersonalDocumentsComponent} from './personal-documents/personal-documents.component';
import {UserGuard} from './shared/services/user.guard';

const routes: Routes = [
	{path: '', redirectTo: 'chat', pathMatch: 'full'},
	{path: 'chat', component: ChatComponent},
	{path: 'personal-documents', component: PersonalDocumentsComponent, canActivate: [UserGuard]},
	{path: 'admin', component: AdminComponent, canActivate: [AdminGuard]},
	{path: 'tips', component: TipsComponent},
	{path: 'tools', component: ToolsHomeComponent}
];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
