import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HeartPulse,
  History,
  RefreshCw,
} from "lucide-react";
import { Button, toast } from "@fayz-ai/saas/ui";
import type { ConnectorDefinition } from "@fayz-ai/saas";
import { createGoogleCalendarProvider } from "./data/supabase";
import type {
  CalendarIntegrationHealth,
  CalendarSyncLogEntry,
} from "./types";

const provider = createGoogleCalendarProvider();

function GoogleCalendarPanel() {
  const [connected, setConnected] = useState(false);
  const [calendarId, setCalendarId] = useState("primary");
  const [syncing, setSyncing] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [professionals, setProfessionals] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [log, setLog] = useState<CalendarSyncLogEntry[]>([]);
  const [health, setHealth] = useState<CalendarIntegrationHealth | null>(null);
  useEffect(() => {
    void provider.getIntegration().then((value) => {
      setConnected(Boolean(value?.connected));
      if (value) {
        setCalendarId(value.calendarId);
        setAssigneeId(value.mappedAssigneeId ?? "");
      }
      if (value?.connected) {
        void provider.getSyncLog().then(setLog);
        void provider.getHealth().then(setHealth).catch((error) =>
          toast.error(`Não foi possível consultar a saúde: ${error.message}`)
        );
        void provider.getMappingOptions().then((result) =>
          setProfessionals(result.professionals)
        );
      }
    }).catch((error) => toast.error(error.message));
  }, []);
  if (!connected) return null;
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className="text-xs font-medium text-muted-foreground">
            ID do calendário
          </span>
          <input
            className="mt-1 w-full rounded-input border border-input bg-card px-3 py-2 text-sm"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            placeholder="primary"
          />
        </label>
        <label className="block min-w-[220px] flex-1">
          <span className="text-xs font-medium text-muted-foreground">
            Profissional para eventos externos
          </span>
          <select
            className="mt-1 w-full rounded-input border border-input bg-card px-3 py-2 text-sm"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Selecione</option>
            {professionals.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!assigneeId}
          onClick={() =>
            void provider.setMapping(assigneeId).then(() =>
              toast.success("Profissional salvo")
            ).catch((e) => toast.error(e.message))}
        >
          Salvar profissional
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void provider.setCalendar(calendarId).then(() =>
              toast.success("Calendário salvo")
            ).catch((e) => toast.error(e.message))}
        >
          Salvar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void provider.syncNow().then((r) => {
              toast.success(`${r.written} agendamento(s) atualizado(s)`);
              return Promise.all([
                provider.getSyncLog(),
                provider.getHealth(),
              ]);
            }).then(([nextLog, nextHealth]) => {
              setLog(nextLog);
              setHealth(nextHealth);
            }).catch((e) => toast.error(e.message)).finally(() =>
              setSyncing(false)
            );
          }}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
          />{" "}
          Sincronizar agora
        </Button>
      </div>
      {health && (
        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4" />
            <h4 className="font-semibold">Saúde da sincronização automática</h4>
            {health.alerts.length === 0
              ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Operacional
                </span>
              )
              : (
                <span className="ml-auto flex items-center gap-1 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5" /> Requer atenção
                </span>
              )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Saída pendente: {health.outboxPending}</span>
            <span>Entrada pendente: {health.inboxPending}</span>
            <span>Falhas definitivas: {health.outboxDead + health.inboxDead}</span>
            {health.lastSyncAt && (
              <span>
                Última sincronização: {new Date(health.lastSyncAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          {health.alerts.length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-2">
              {health.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={alert.severity === "critical"
                    ? "text-destructive"
                    : "text-warning"}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {log.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Histórico</h4>
          </div>
          <div className="divide-y rounded-md border text-sm">
            {log.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </span>
                <span>{item.direction}</span>
                <span className="ml-auto text-xs">
                  {item.written}/{item.fetched}
                </span>
                {item.status === "success"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  : <AlertCircle className="h-3.5 w-3.5 text-warning" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const googleCalendarConnector: ConnectorDefinition = {
  id: "google-calendar",
  hostPluginId: "agenda",
  name: "Google Calendar",
  description: "Sincronização bidirecional entre a agenda e o Google Calendar.",
  icon: "Calendar",
  authKind: "oauth",
  async getStatus() {
    return { connected: Boolean((await provider.getIntegration())?.connected) };
  },
  startOAuth: (redirectTo) => provider.getConnectUrl(redirectTo),
  disconnect: () => provider.disconnect(),
  ExtraPanel: GoogleCalendarPanel,
};
