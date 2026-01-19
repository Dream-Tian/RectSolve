export interface Config {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CaptureRequest {
  type: 'CAPTURE_SOLVE';
  rect: Rect;
  dpr: number;
}

export interface CaptureResponse {
  success: boolean;
  markdown?: string;
  imageDataUrl?: string;
  error?: string;
}

export interface ModelListRequest {
  type: 'LIST_MODELS';
}

export interface ModelListResponse {
  success: boolean;
  models?: string[];
  error?: string;
}

export type Message = CaptureRequest | ModelListRequest;
export type Response = CaptureResponse | ModelListResponse;
