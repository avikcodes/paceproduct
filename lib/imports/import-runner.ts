import "server-only";

const encoder = new TextEncoder();

function jsonLine(data: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(data)}\n`);
}

type Sender = (event: {
  type: "progress" | "done" | "error";
  [key: string]: unknown;
}) => void;

type ImportRunnerOptions = {
  capability: unknown;
  spec: unknown;
  loadRefs: unknown;
  dedupe: unknown;
  create: unknown;
  revalidate: unknown;
};

export function runCsvImport(
  _request: Request,
  _options: ImportRunnerOptions,
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const send: Sender = (event) => controller.enqueue(jsonLine(event));

      try {
        // TODO: Get userId from new auth system
        send({ type: "error", message: "Unauthorized" });
        return;
      } catch {
        try {
          send({
            type: "error",
            message: "Something went wrong while importing. No rows were imported.",
          });
        } catch {
          // Client disconnected.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
