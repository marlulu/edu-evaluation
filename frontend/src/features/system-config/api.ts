import axios from 'axios';

const baseUrl = '/api/system/model-profiles';

export type ModelProfile = {
  id: string; providerName: string; note: string | null; website: string | null; apiKeyHelpUrl: string | null;
  baseUrl: string; maskedApiKey: string; modelName: string; active: boolean;
  lastTestSuccess: boolean | null; lastTestMessage: string | null; lastTestedAt: string | null;
};
export type ModelProfileInput = {
  providerName: string; note?: string; website?: string; apiKeyHelpUrl?: string;
  baseUrl: string; apiKey: string; modelName: string;
};
export type ModelTestResult = { success: boolean; message: string; latencyMs: number; testedAt: string; requestedModel?: string; requestedBaseUrl?: string };

export async function fetchModelProfiles(): Promise<ModelProfile[]> {
  return (await axios.get<ModelProfile[]>(baseUrl)).data;
}
export async function createModelProfile(input: ModelProfileInput): Promise<ModelProfile> {
  return (await axios.post<ModelProfile>(baseUrl, input)).data;
}
export async function updateModelProfile(id: string, input: ModelProfileInput): Promise<ModelProfile> {
  return (await axios.put<ModelProfile>(`${baseUrl}/${id}`, input)).data;
}
export async function activateModelProfile(id: string): Promise<ModelProfile> {
  return (await axios.post<ModelProfile>(`${baseUrl}/${id}/activate`)).data;
}
export async function testModelProfile(id: string): Promise<ModelTestResult> {
  return (await axios.post<ModelTestResult>(`${baseUrl}/${id}/test`)).data;
}
export async function deleteModelProfile(id: string): Promise<void> { await axios.delete(`${baseUrl}/${id}`); }
