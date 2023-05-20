const tsConfigFile = "./tsconfig.jest.json"

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.mjs"],
  testEnvironment: "jsdom",
  rootDir: "./",
  testPathIgnorePatterns: ["<rootDir>/playwright/", "<rootDir>/node_modules/"],
  transform: {
    "^.+\\.m?[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: tsConfigFile
      }
    ]
  },
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/test/config/svgr-mock.tsx",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.css$": "identity-obj-proxy",
    "@formkit/auto-animate/react": "<rootDir>/test/config/auto-animate.ts",
    "easy-speech": "<rootDir>/test/config/easy-speech.ts"
  },
  clearMocks: true
}

export default config
