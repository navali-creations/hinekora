function isWindowsOS(platform: NodeJS.Platform = process.platform): boolean {
  return platform === "win32";
}

export { isWindowsOS };
