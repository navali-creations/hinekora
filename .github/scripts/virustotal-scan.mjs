#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, createReadStream, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const API_BASE_URL = "https://www.virustotal.com/api/v3";
const LARGE_FILE_THRESHOLD_BYTES = 32 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 650 * 1024 * 1024;
const DEFAULT_POLL_INTERVAL_SECONDS = 20;
const DEFAULT_POLL_TIMEOUT_SECONDS = 600;
const DEFAULT_REPORT_PATH = "virustotal-report.json";
const SCANNED_EXTENSIONS = new Set([".exe", ".nupkg"]);

const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
const maxMalicious = parseNonNegativeInteger(
  process.env.VIRUSTOTAL_MAX_MALICIOUS ?? "0",
  "VIRUSTOTAL_MAX_MALICIOUS",
);
const maxSuspicious = parseNonNegativeInteger(
  process.env.VIRUSTOTAL_MAX_SUSPICIOUS ?? "0",
  "VIRUSTOTAL_MAX_SUSPICIOUS",
);
const pollIntervalSeconds = parsePositiveInteger(
  process.env.VIRUSTOTAL_POLL_INTERVAL_SECONDS ??
    String(DEFAULT_POLL_INTERVAL_SECONDS),
  "VIRUSTOTAL_POLL_INTERVAL_SECONDS",
);
const pollTimeoutSeconds = parsePositiveInteger(
  process.env.VIRUSTOTAL_POLL_TIMEOUT_SECONDS ??
    String(DEFAULT_POLL_TIMEOUT_SECONDS),
  "VIRUSTOTAL_POLL_TIMEOUT_SECONDS",
);
const reportPath =
  process.env.VIRUSTOTAL_REPORT_PATH?.trim() || DEFAULT_REPORT_PATH;

if (!apiKey) {
  throw new Error("VIRUSTOTAL_API_KEY is required to scan release artifacts");
}

const artifactRoots = process.argv.slice(2);
const artifacts = await findArtifacts(
  artifactRoots.length > 0 ? artifactRoots : ["out/make"],
);

if (artifacts.length === 0) {
  throw new Error("No .exe or .nupkg artifacts found for VirusTotal scanning");
}

const results = [];

for (const artifact of artifacts) {
  try {
    results.push(await scanArtifact(artifact));
  } catch (error) {
    results.push({
      file: basename(artifact),
      passed: false,
      source: "error",
      error: safeErrorMessage(error),
    });
  }
}

writeReport(results);
writeSummary(results);

const failures = results.filter((result) => !result.passed);
if (failures.length > 0) {
  throw new Error(
    failures
      .map((failure) =>
        [failure.file, failure.error ?? "VirusTotal thresholds exceeded"]
          .filter(Boolean)
          .join(": "),
      )
      .join("\n"),
  );
}

async function scanArtifact(filePath) {
  const fileStats = await stat(filePath);
  const artifactName = basename(filePath);
  const sha256 = await hashFile(filePath);
  const reportUrl = `https://www.virustotal.com/gui/file/${sha256}`;

  if (fileStats.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${artifactName} is ${formatBytes(fileStats.size)}, which exceeds VirusTotal's 650 MB upload limit`,
    );
  }

  console.log(
    `Checking VirusTotal cache for ${artifactName} (${formatBytes(fileStats.size)}, sha256 ${sha256})`,
  );

  const cachedFileReport = await getFileReport(sha256);

  if (cachedFileReport) {
    console.log(`Using existing VirusTotal report for ${artifactName}`);
    return createScanResult({
      artifactName,
      fileStats,
      sha256,
      reportUrl,
      source: "cache",
      fileReport: cachedFileReport,
    });
  }

  console.log(`No VirusTotal report found for ${artifactName}; uploading`);

  const uploadUrl =
    fileStats.size > LARGE_FILE_THRESHOLD_BYTES
      ? await getLargeFileUploadUrl()
      : `${API_BASE_URL}/files`;
  const uploadResponse = uploadFile(uploadUrl, filePath);
  const analysisId = uploadResponse.data?.id;

  if (typeof analysisId !== "string" || analysisId.length === 0) {
    throw new Error(
      `VirusTotal upload response for ${artifactName} did not include an analysis id`,
    );
  }

  const analysis = await waitForAnalysis(analysisId, artifactName);
  const fileReport = await getFileReport(sha256);

  return createScanResult({
    artifactName,
    fileStats,
    sha256,
    reportUrl,
    source: "upload",
    analysisId,
    analysis,
    fileReport,
  });
}

function createScanResult({
  artifactName,
  fileStats,
  sha256,
  reportUrl,
  source,
  analysisId = null,
  analysis = null,
  fileReport = null,
}) {
  const attributes = getResultAttributes({ analysis, fileReport });
  const stats = attributes.stats;
  const malicious = Number(stats.malicious ?? 0);
  const suspicious = Number(stats.suspicious ?? 0);
  const detections = summarizeDetections(attributes.results);
  const passed = malicious <= maxMalicious && suspicious <= maxSuspicious;

  console.log(
    `${artifactName}: source=${source}, malicious=${malicious}, suspicious=${suspicious}, report=${reportUrl}`,
  );

  return {
    file: artifactName,
    sha256,
    sizeBytes: fileStats.size,
    source,
    passed,
    malicious,
    suspicious,
    detections,
    analysisId,
    reportUrl,
    fileReport,
    analysis,
    error: passed
      ? null
      : [
          `malicious=${malicious}/${maxMalicious}`,
          `suspicious=${suspicious}/${maxSuspicious}`,
          detections.length > 0 ? `detections=${detections.join(", ")}` : null,
          `report=${reportUrl}`,
        ]
          .filter(Boolean)
          .join("; "),
  };
}

function getResultAttributes({ analysis, fileReport }) {
  const fileAttributes = fileReport?.data?.attributes;
  const analysisAttributes = analysis?.data?.attributes;

  return {
    stats:
      fileAttributes?.last_analysis_stats ?? analysisAttributes?.stats ?? {},
    results:
      fileAttributes?.last_analysis_results ??
      analysisAttributes?.results ??
      {},
  };
}

async function findArtifacts(roots) {
  const files = [];

  for (const root of roots) {
    await walk(resolve(root), files);
  }

  return files
    .filter((file) => SCANNED_EXTENSIONS.has(extname(file).toLowerCase()))
    .sort((first, second) => first.localeCompare(second));
}

async function walk(path, files) {
  const pathStats = await stat(path);

  if (pathStats.isFile()) {
    files.push(path);
    return;
  }

  if (!pathStats.isDirectory()) {
    return;
  }

  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    await walk(join(path, entry.name), files);
  }
}

async function getLargeFileUploadUrl() {
  const response = await virusTotalGet("/files/upload_url");
  const uploadUrl = response.data;

  if (typeof uploadUrl !== "string" || uploadUrl.length === 0) {
    throw new Error("VirusTotal did not return a large-file upload URL");
  }

  return uploadUrl;
}

async function getFileReport(sha256) {
  const response = await fetch(
    `${API_BASE_URL}/files/${encodeURIComponent(sha256)}`,
    {
      headers: {
        "x-apikey": apiKey,
      },
    },
  );
  const body = await response.text();

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `VirusTotal file report request failed (${response.status}): ${body}`,
    );
  }

  return parseJson(body, "VirusTotal file report response");
}

function uploadFile(uploadUrl, filePath) {
  const result = spawnSync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--fail-with-body",
      "--request",
      "POST",
      "--url",
      uploadUrl,
      "--header",
      `x-apikey: ${apiKey}`,
      "--form",
      `file=@${filePath}`,
    ],
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `VirusTotal upload failed: ${result.stderr || result.stdout}`,
    );
  }

  return parseJson(result.stdout, "VirusTotal upload response");
}

async function waitForAnalysis(analysisId, artifactName) {
  const deadline = Date.now() + pollTimeoutSeconds * 1000;

  while (Date.now() <= deadline) {
    const analysis = await virusTotalGet(
      `/analyses/${encodeURIComponent(analysisId)}`,
    );
    const status = analysis.data?.attributes?.status;

    if (status === "completed") {
      return analysis;
    }

    console.log(`${artifactName}: VirusTotal analysis status is ${status}`);
    await sleep(pollIntervalSeconds * 1000);
  }

  throw new Error(
    `${artifactName} VirusTotal analysis did not complete within ${pollTimeoutSeconds} seconds`,
  );
}

async function virusTotalGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "x-apikey": apiKey,
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`VirusTotal request failed (${response.status}): ${body}`);
  }

  return parseJson(body, `VirusTotal response from ${path}`);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} was not valid JSON: ${error.message}`);
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");

  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });

  return hash.digest("hex");
}

function summarizeDetections(results) {
  return Object.values(results)
    .filter(
      (result) =>
        result?.category === "malicious" || result?.category === "suspicious",
    )
    .slice(0, 10)
    .map(
      (result) => `${result.engine_name}:${result.result ?? result.category}`,
    );
}

function writeSummary(results) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) {
    return;
  }

  const lines = [
    "## VirusTotal scan",
    "",
    "| Artifact | Source | Status | Malicious | Suspicious | Report |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...results.map(
      (result) =>
        `| ${escapeMarkdown(result.file)} | ${result.source} | ${result.passed ? "passed" : "failed"} | ${result.malicious ?? "-"} | ${result.suspicious ?? "-"} | ${formatReportLink(result)} |`,
    ),
    "",
  ];

  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function writeReport(results) {
  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      maxMalicious,
      maxSuspicious,
    },
    artifacts: results,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`VirusTotal report written to ${reportPath}`);
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return parsed;
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function formatBytes(value) {
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeMarkdown(value) {
  return value.replaceAll("|", "\\|");
}

function formatReportLink(result) {
  if (!result.reportUrl || !result.sha256) {
    return "-";
  }

  return `[${result.sha256.slice(0, 12)}](${result.reportUrl})`;
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}
