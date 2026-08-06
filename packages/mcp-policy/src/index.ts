export interface McpToolRequest {
  server: string;
  tool: string;
  argumentsDigest: string;
}

export interface McpPolicy {
  permits(request: McpToolRequest): Promise<boolean>;
}
