const { app, net, protocol } = require("electron");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "hinekora-media",
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);
app.disableHardwareAcceleration();

async function run() {
  const mediaModulePath = process.argv[2];
  const mediaPath = process.argv[3];
  if (!mediaModulePath || !mediaPath) {
    throw new Error("Media probe arguments are missing");
  }

  const { createMediaFileResponse } = require(mediaModulePath);
  await app.whenReady();
  protocol.handle("hinekora-media", (request) =>
    createMediaFileResponse(mediaPath, request, (url, init) =>
      net.fetch(url, init)
    )
  );
  const response = await net.fetch(
    "hinekora-media://replay-clip/integration-probe",
    { headers: { Range: "bytes=2-5" } }
  );
  const body = Buffer.from(await response.arrayBuffer()).toString("utf8");
  process.stdout.write(
    `HINEKORA_MEDIA_RESULT:${JSON.stringify({
      body,
      cacheControl: response.headers.get("cache-control"),
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      status: response.status,
    })}\n`
  );
}

run()
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
