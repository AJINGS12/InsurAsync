// Shared helper for registering WebMCP tools safely.
//
// - Confirms `document.modelContext` actually exists before attempting
//   to register.
// - Tolerates duplicate-registration errors, which happen in React
//   Strict Mode dev builds (React intentionally mounts each component
//   twice) when the browser's WebMCP implementation doesn't support
//   `unregisterTool` yet, or when navigating back to an already-visited
//   page without a full reload.
// - Handles BOTH a synchronous throw and a rejected Promise, since
//   different WebMCP implementations may do either.

function isDuplicateToolError(err) {
  return (
    err &&
    (err.name === "InvalidStateError" ||
      /duplicate tool name/i.test(err.message || ""))
  );
}

export function registerToolSafely(toolDefinition) {
  if (typeof document === "undefined" || !document.modelContext) {
    console.warn(
      `[WebMCP] document.modelContext not available — "${toolDefinition.name}" not registered. ` +
      `Open this page in a WebMCP-enabled browser (Chrome with chrome://flags/#enable-webmcp-testing, or ChatGPT's in-app browser).`
    );
    return () => {};
  }

  // First, try to remove any stale registration from a previous mount
  // (Strict Mode double-invoke, or revisiting this page) before
  // registering fresh. This is the most reliable fix, when supported.
  if (typeof document.modelContext.unregisterTool === "function") {
    try {
      document.modelContext.unregisterTool(toolDefinition.name);
    } catch {
      // Fine if there was nothing to unregister.
    }
  }

  try {
    const result = document.modelContext.registerTool(toolDefinition);

    // If registerTool returns a Promise, attach a catch so a rejection
    // doesn't surface as an unhandled rejection / dev overlay crash.
    if (result && typeof result.then === "function") {
      result.catch((err) => {
        if (isDuplicateToolError(err)) {
          console.warn(
            `[WebMCP] "${toolDefinition.name}" was already registered — skipping duplicate.`
          );
        } else {
          console.error(`[WebMCP] Failed to register tool "${toolDefinition.name}":`, err);
        }
      });
    }
  } catch (err) {
    if (isDuplicateToolError(err)) {
      console.warn(
        `[WebMCP] "${toolDefinition.name}" was already registered — skipping duplicate.`
      );
    } else {
      console.error(`[WebMCP] Failed to register tool "${toolDefinition.name}":`, err);
    }
  }

  return () => {
    if (typeof document.modelContext.unregisterTool === "function") {
      try {
        document.modelContext.unregisterTool(toolDefinition.name);
      } catch {
        // Ignore — tool may already be gone.
      }
    }
  };
}