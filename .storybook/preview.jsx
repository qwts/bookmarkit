import React from "react";
import "../src/index.css";

const preview = {
  decorators: [
    (_Story) => (
      <div
        style={{
          minHeight: "100vh",
          padding: "1.5rem",
          color: "var(--text-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <_Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "error" },
  },
};

export default preview;
