import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { localizeNotificationMessage } from "@/lib/notification-messages";

describe("localizeNotificationMessage", () => {
  it("localizes the fixed unknown-error fallback but preserves arbitrary backend details", () => {
    const fallback = localizeNotificationMessage(
      "Auto-delete failed",
      '"Game" was imported successfully, but removing it from the download client failed: unknown error. Please remove it manually.',
      "es"
    );
    const fallbackMarkup = renderToStaticMarkup(<>{fallback.content}</>);

    expect(fallbackMarkup).toContain("error desconocido");
    expect(fallbackMarkup).not.toContain(">unknown error<");

    const providerDetail = localizeNotificationMessage(
      "Auto-delete failed",
      '"Game" was imported successfully, but removing it from the download client failed: Transmission: connection reset. Please remove it manually.',
      "es"
    );
    const providerMarkup = renderToStaticMarkup(<>{providerDetail.content}</>);

    expect(providerMarkup).toContain("Transmission: connection reset");
    expect(providerMarkup).toContain('lang="en"');
  });
});
