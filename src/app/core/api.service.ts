import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './config';
import {
  AccusationBody, CaseCreateBody, CaseDetail, CaseSummary, Investigation, LinkDto, ResultDto
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  createPlayer(username: string, email: string) {
    return firstValueFrom(this.http.post<{ id: number }>(`${API_URL}/players`, { username, email }));
  }

  listCases(search?: string) {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return firstValueFrom(this.http.get<CaseSummary[]>(`${API_URL}/cases`, { params }));
  }

  addCase(adminId: number, body: CaseCreateBody) {
    const params = new HttpParams().set('adminId', adminId);
    return firstValueFrom(this.http.post<CaseSummary>(`${API_URL}/admin/cases`, body, { params }));
  }

  startInvestigation(playerId: number, caseId: number) {
    return firstValueFrom(this.http.post<Investigation>(`${API_URL}/investigations`, { playerId, caseId }));
  }

  getInvestigation(id: number) {
    return firstValueFrom(this.http.get<Investigation>(`${API_URL}/investigations/${id}`));
  }

  getCaseDetail(id: number) {
    return firstValueFrom(this.http.get<CaseDetail>(`${API_URL}/investigations/${id}/case`));
  }

  getLinks(id: number) {
    return firstValueFrom(this.http.get<LinkDto[]>(`${API_URL}/investigations/${id}/links`));
  }

  link(id: number, fromEvidenceId: number, toEvidenceId: number) {
    return firstValueFrom(this.http.post<LinkDto>(`${API_URL}/investigations/${id}/links`, { fromEvidenceId, toEvidenceId }));
  }

  accuse(id: number, body: AccusationBody) {
    return firstValueFrom(this.http.post<ResultDto>(`${API_URL}/investigations/${id}/accusation`, body));
  }

  getResult(id: number) {
    return firstValueFrom(this.http.get<ResultDto>(`${API_URL}/investigations/${id}/result`));
  }
}
