/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import type { Notification } from "@shared/schema";

import { NotificationItem } from "../src/components/NotificationItem";

describe("NotificationItem accessible context", () => {
  it("announces read state, title, and the notification message", () => {
    const message = "The release is ready to import.";
    const notification = {
      id: "notification-1",
      userId: "user-1",
      type: "success",
      title: "Download completed",
      message,
      read: false,
      createdAt: new Date(),
    } as Notification;

    render(<NotificationItem notification={notification} onRead={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: /Unread notification: Download completed/,
    });
    expect(button).toHaveAccessibleName(new RegExp(message));
    expect(screen.getByText(message)).toBeVisible();
  });
});
