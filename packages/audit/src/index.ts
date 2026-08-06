export interface AuditEvent {
  id: string;
  organizationId: string;
  eventType: string;
  outcome: "allowed" | "denied" | "error";
  occurredAt: Date;
  correlationId: string;
  metadata: Readonly<Record<string, string>>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}
