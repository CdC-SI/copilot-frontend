import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigurationService } from '../../core/app-configuration/configuration.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { TokenService } from './token.service';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { SettingsEventService } from './settings-event.service';

@Injectable({
    providedIn: 'root'
})
export class UploadService {
    constructor(
        private readonly config: ConfigurationService,
        private readonly http: HttpClient,
        private readonly translateService: TranslateService,
        private readonly tokenService: TokenService,
        private readonly settingsEventService: SettingsEventService
    ) {}

    uploadPdf(file: File): Observable<{ content: string; files: string[] }> {
        console.log('Starting PDF upload');
        const formData = new FormData();
        formData.append('files', file, file.name);
        formData.append('embed', 'true');
        formData.append('language', this.translateService.currentLang);

        let headers = new HttpHeaders();
        const token = this.tokenService.getToken();
        if (token) {
            headers = headers
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json');
        } else {
            console.log('No token available');
        }

        return this.http.post<{ content: string; files: string[] }>(
            this.config.backendApi('/documents/upload'),
            formData,
            { headers }
        ).pipe(
            tap(response => {
                console.log('Upload response:', response);
                this.settingsEventService.emitSettingsRefresh();
            }),
            catchError(error => {
                console.error('Error during upload:', error);
                this.settingsEventService.emitSettingsRefresh(); // Workaround to refresh settings after upload error --> remove after fix
                return throwError(error);
            })
        );
    }
}
