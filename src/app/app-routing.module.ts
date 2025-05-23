import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ChatComponent} from './chat/chat.component';
import {AdminComponent} from './admin/admin.component';
import {TipsComponent} from './tips/tips.component';
import {AdminGuard} from './shared/services/admin.guard';

const routes: Routes = [
	{path: '', redirectTo: 'chat', pathMatch: 'full'},
	{path: 'chat', component: ChatComponent},
	{path: 'admin', component: AdminComponent, canActivate: [AdminGuard]},
	{path: 'tips', component: TipsComponent},
];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
