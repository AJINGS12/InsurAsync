// Shared helper for registering WebMCP tools safely.
//
// - Confirms `document.modelContext` actually exists (WebMCP-enabled
//   browser / ChatGPT in-app browser) before attempting to register.
// - Returns a no-op cleanup function when unsupported, so calling code
//   doesn't need to branch on support itself.

export function registerToolSafely(toolDefinition) {
  if (typeof document === "undefined" || !document.modelContext) {
    console.warn(
      `[WebMCP] document.modelContext not available — "${toolDefinition.name}" not registered. ` +
      `Open this page in a WebMCP-enabled browser (Chrome with chrome://flags/#enable-webmcp-testing, or ChatGPT's in-app browser).`
    );
    return () => {};
  }

  document.modelContext.registerTool(toolDefinition);

  // Not all WebMCP implementations expose an unregister method yet;
  // guard defensively so this works across environments.
  return () => {
    if (typeof document.modelContext.unregisterTool === "function") {
      document.modelContext.unregisterTool(toolDefinition.name);
    }
  };
}
