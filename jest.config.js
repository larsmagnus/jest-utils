module.exports = {
  // Custom reporter configuration
  reporters: [
    "default", // Keep the default reporter
    [
      "<rootDir>/reporters/custom-reporter.js",
      {
        logFile: "test-report.log",
        enableLeakDetection: true,
        leakDetection: {
          memoryThresholdMB: 25,
          generateHeapSnapshots: false,
          verbose: false,
        },
      },
    ],
  ],
  projects: [
    {
      displayName: "client",
      testMatch: [
        "<rootDir>/mixed/**/*.client.test.js",
        "<rootDir>/mixed/**/*.test.js",
        "!**/*.server.test.js",
      ],
      testEnvironment: "jsdom",
    },
    {
      displayName: "server",
      testMatch: [
        "<rootDir>/mixed/**/*.server.test.js",
        "<rootDir>/mixed/**/*.test.js",
        "!**/*.client.test.js",
      ],
      testEnvironment: "node",
    },
  ],
};
