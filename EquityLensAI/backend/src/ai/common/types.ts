export type AiGenerateInput = {
  prompt: string;
  systemInstruction: string;
  responseJsonSchema: Record<string, unknown>;
  requestId?: string | undefined;
  instrument?: string | undefined;
  intent?: string | undefined;
};

export type AiGenerateOutput = {
  text: string;
  model: string;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
};

export interface AiClient {
  readonly id: string;
  generate(input: AiGenerateInput): Promise<AiGenerateOutput>;
}
