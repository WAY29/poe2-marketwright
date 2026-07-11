"use strict";

const vm = require("node:vm");

function formatLogArguments(argumentsList) {
  return argumentsList
    .map((argument) => (typeof argument === "string" ? argument : JSON.stringify(argument)))
    .join(" ");
}

async function runScript(source) {
  const output = [];
  const sandbox = {
    AbortController,
    AbortSignal,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console: {
      log(...argumentsList) {
        output.push(formatLogArguments(argumentsList));
      }
    },
    queueMicrotask,
    require,
    setInterval,
    setTimeout,
    structuredClone
  };
  const execution = vm.runInNewContext(source, sandbox, { filename: "test-scenario.js" });

  await execution;

  if (output.length !== 1) {
    throw new Error(`Expected one JSON result, received ${output.length}: ${output.join("\\n")}`);
  }

  try {
    return JSON.parse(output[0]);
  } catch (error) {
    throw new Error(`Scenario did not log valid JSON: ${output[0]}`, { cause: error });
  }
}

module.exports = { runScript };
