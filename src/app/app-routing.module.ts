import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {HomeComponent} from './home/home.component';
import {AdminComponent} from './admin/admin.component';
import {AdminGuard} from './shared/services/admin.guard';

const routes: Routes = [
	{path: '', redirectTo: 'home', pathMatch: 'full'},
	{path: 'home', component: HomeComponent},
	{path: 'admin', component: AdminComponent, canActivate: [AdminGuard]}
];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
