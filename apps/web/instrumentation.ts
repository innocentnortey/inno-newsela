// NL-23: Next.js server start hook; records one process_start ops_event (never fatal).
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  try {
    const { load_web_settings } = await import("@ls/config/settings");
    const { create_logger } = await import("@ls/obs/logger");
    const { write_start_event } = await import("./src/server/start-event.ts");
    const settings = load_web_settings(process.env);
    const logger = create_logger({ service: "web", build_id: settings.shared.build_id, level: settings.shared.log_level });
    void write_start_event(settings, logger);
  } catch (e) {
    process.stderr.write(`web start event skipped: ${e instanceof Error ? e.name : "Error"}\n`);
  }
}
