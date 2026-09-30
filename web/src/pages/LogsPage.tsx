import {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { FileText, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router";
import {
  Banner,
  Button,
  Field,
  Select,
  Stack,
  Switch,
  Tabs,
} from "@trade/ui";
import "@trade/ui/styles.css";
import { api } from "@/lib/api";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Label } from "@nous-research/ui/ui/components/label";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { useI18n } from "@/i18n";
import { usePageHeader } from "@/contexts/usePageHeader";
import { PluginSlot } from "@/plugins";
// Level classification is unit-tested in @/lib/log-classify; it prefers the
// structured level token and falls back to word-boundary matching so payload
// text like "parse_errors=0" can't render an INFO line red.
import { classifyLine } from "@/lib/log-classify";
import { errorMessage } from "@/lib/api-error";
import "./pilot-trade-ui.css";

const FILES = ["agent", "errors", "gateway"] as const;
const LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR"] as const;
const COMPONENTS = ["all", "gateway", "agent", "tools", "cli", "cron"] as const;
const LINE_COUNTS = [50, 100, 200, 500] as const;

const LINE_COLORS: Record<string, string> = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-foreground",
  debug: "text-text-tertiary",
};

// PILOT: the filter controls below are @trade/ui components; labels stay on the
// dashboard's type scale (minimum text-xs, per the web README typography rules).
const labelClass = "text-xs text-muted-foreground";

const formatFilterLabel = (value: string) => value.toUpperCase();

type LogFile = (typeof FILES)[number];

function isLogFile(value: string | null): value is LogFile {
  return (FILES as readonly string[]).includes(value ?? "");
}

export default function LogsPage() {
  // `?file=gateway` deep link (System page "Open logs" next to a failed gateway).
  const [searchParams] = useSearchParams();
  const requestedFile = searchParams.get("file");
  const [file, setFile] = useState<LogFile>(() =>
    isLogFile(requestedFile) ? requestedFile : "agent",
  );
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("ALL");
  const [component, setComponent] =
    useState<(typeof COMPONENTS)[number]>("all");
  const [lineCount, setLineCount] = useState<(typeof LINE_COUNTS)[number]>(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const { setAfterTitle, setEnd } = usePageHeader();

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getLogs({ file, lines: lineCount, level, component })
      .then((resp) => {
        setLines(resp.lines);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 50);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [file, lineCount, level, component]);

  useLayoutEffect(() => {
    setAfterTitle(
      <span
        className="pilot-trade-ui flex items-center gap-1.5"
        data-theme="dark"
      >
        <Badge tone="secondary" className="text-xs">
          {formatFilterLabel(file)} · {formatFilterLabel(level)} ·{" "}
          {formatFilterLabel(component)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          density="compact"
          onClick={fetchLogs}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-label={t.common.refresh}
        >
          {loading ? <Spinner /> : <RefreshCw />}
        </Button>
      </span>,
    );
    setEnd(
      <div
        className="pilot-trade-ui flex w-full min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-3"
        data-theme="dark"
      >
        <div className="flex items-center gap-2">
          <Label htmlFor="logs-auto-refresh" className="text-xs cursor-pointer">
            {t.logs.autoRefresh}
          </Label>
          <Switch
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.currentTarget.checked)}
            id="logs-auto-refresh"
          />
          {autoRefresh && (
            <Badge tone="success" className="text-xs">
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {t.common.live}
            </Badge>
          )}
        </div>
      </div>,
    );
    return () => {
      setAfterTitle(null);
      setEnd(null);
    };
  }, [
    autoRefresh,
    component,
    file,
    level,
    loading,
    setAfterTitle,
    setEnd,
    t.common.live,
    t.common.refresh,
    t.logs.autoRefresh,
    fetchLogs,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const fileTabItems = FILES.map((value) => ({
    key: value,
    label: formatFilterLabel(value),
  }));
  const levelOptions = LEVELS.map((value) => ({
    value,
    label: formatFilterLabel(value),
  }));
  const componentOptions = COMPONENTS.map((value) => ({
    value,
    label: formatFilterLabel(value),
  }));
  const lineOptions = LINE_COUNTS.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  return (
    <div
      className="pilot-trade-ui ui-root flex min-w-0 max-w-full flex-col gap-4"
      data-theme="dark"
    >
      <PluginSlot name="logs:top" />
      <Stack
        direction="row"
        gap={6}
        wrap
        role="toolbar"
        aria-label={t.logs.title}
        className="min-w-0 max-w-full items-start"
      >
        <Stack gap={1} className="min-w-0">
          <span className={labelClass}>{t.logs.file}</span>
          <Tabs
            items={fileTabItems}
            value={file}
            onChange={(key) => {
              if (isLogFile(key)) setFile(key);
            }}
            density="compact"
          />
        </Stack>

        <Field label={t.logs.level} className="min-w-0">
          <Select
            options={levelOptions}
            value={level}
            variant="listbox"
            density="compact"
            onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
          />
        </Field>

        <Field label={t.logs.component} className="min-w-0">
          <Select
            options={componentOptions}
            value={component}
            variant="listbox"
            density="compact"
            onChange={(e) =>
              setComponent(e.target.value as (typeof COMPONENTS)[number])
            }
          />
        </Field>

        <Field label={t.logs.lines} className="min-w-0">
          <Select
            options={lineOptions}
            value={String(lineCount)}
            variant="listbox"
            density="compact"
            onChange={(e) =>
              setLineCount(Number(e.target.value) as (typeof LINE_COUNTS)[number])
            }
          />
        </Field>
      </Stack>

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {file}.log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-3">
              <Banner tone="danger">{error}</Banner>
            </div>
          )}

          <div
            ref={scrollRef}
            className="max-w-full min-h-[400px] max-h-[calc(100vh-220px)] overflow-auto p-4 font-mono-ui text-xs leading-5 break-words"
          >
            {lines.length === 0 && !loading && (
              <p className="text-muted-foreground text-center py-8">
                {t.logs.noLogLines}
              </p>
            )}
            {lines.map((line, i) => {
              const cls = classifyLine(line);
              return (
                <div
                  key={i}
                  className={`${LINE_COLORS[cls]} hover:bg-secondary/20 px-1 -mx-1`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <PluginSlot name="logs:bottom" />
    </div>
  );
}
