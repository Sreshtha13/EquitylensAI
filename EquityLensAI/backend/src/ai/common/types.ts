export type AiGenerateInput = {
  prompt: string;
  context?: Record<string, unknown>;
};

export type AiGenerateOutput = {
  text: string;
  model: string;
};

export interface AiClient {
  readonly id: string;
  generate(input: AiGenerateInput): Promise<AiGenerateOutput>;
}
