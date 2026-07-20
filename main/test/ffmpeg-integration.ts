import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bundledFfmpegPath = resolve("node_modules/noobs/dist/bin/ffmpeg.exe");
const bundledFfprobePath = resolve("node_modules/noobs/dist/bin/ffprobe.exe");

interface FfmpegTestMediaMetadata {
  durationSeconds: number;
  sizeBytes: number;
  streams: Array<{
    codecName: string;
    codecType: string;
    height?: number;
    width?: number;
  }>;
}

async function createFfmpegTestSource(input: {
  durationSeconds: number;
  outputPath: string;
  size?: string;
  withAudio: boolean;
}) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=${input.size ?? "320x180"}:rate=30:duration=${input.durationSeconds}`,
  ];
  if (input.withAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=1000:sample_rate=48000:duration=${input.durationSeconds}`,
      "-shortest",
    );
  }
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p");
  if (input.withAudio) {
    args.push("-c:a", "aac");
  }
  args.push(input.outputPath);

  await execFileAsync(bundledFfmpegPath, args);
}

async function decodeFfmpegTestMedia(input: {
  outputPath: string;
  withAudio: boolean;
}) {
  const maps = ["-map", "0:v:0"];
  if (input.withAudio) {
    maps.push("-map", "0:a:0");
  }

  const { stderr } = await execFileAsync(bundledFfmpegPath, [
    "-v",
    "error",
    "-xerror",
    "-err_detect",
    "explode",
    "-i",
    input.outputPath,
    ...maps,
    "-f",
    "null",
    "-",
  ]);
  if (stderr.trim()) {
    throw new Error(`FFmpeg reported decode errors: ${stderr.trim()}`);
  }
}

async function probeFfmpegTestMedia(
  outputPath: string,
): Promise<FfmpegTestMediaMetadata> {
  const { stdout } = await execFileAsync(bundledFfprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height",
    "-of",
    "json",
    outputPath,
  ]);
  const metadata = JSON.parse(stdout) as {
    format: { duration: string; size: string };
    streams: Array<{
      codec_name: string;
      codec_type: string;
      height?: number;
      width?: number;
    }>;
  };

  return {
    durationSeconds: Number(metadata.format.duration),
    sizeBytes: Number(metadata.format.size),
    streams: metadata.streams.map((stream) => ({
      codecName: stream.codec_name,
      codecType: stream.codec_type,
      ...(stream.height === undefined ? {} : { height: stream.height }),
      ...(stream.width === undefined ? {} : { width: stream.width }),
    })),
  };
}

export { createFfmpegTestSource, decodeFfmpegTestMedia, probeFfmpegTestMedia };
