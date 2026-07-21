// Upload de arquivos/mídias (item 4). O download usa a URL assinada que o próprio
// recurso devolve (ex.: training.materialUrl) — resolvida com `fileUrl()`.
import { http } from './client';

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type FileKind =
  | 'training_material'
  | 'chat_image'
  | 'chat_audio'
  | 'chat_video' // item 10
  | 'chat_document' // item 10
  | 'document'
  | 'compliance_evidence'
  | 'other';

export const filesApi = {
  upload: (file: File, kind: FileKind = 'other'): Promise<UploadedFile> => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return http.post<UploadedFile>('/files', form);
  },
};
