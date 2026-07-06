//! Platform-specific process detection.
//!
//! TypeScript mental model:
//! - `mod windows;` is like importing `./windows`.
//! - `#[cfg(windows)]` means the Windows implementation is compiled only for
//!   Windows builds.
//! - `#[cfg(not(windows))]` means the stub is compiled only outside Windows.
//!   On a Windows machine rust-analyzer greys it out as "inactive code"; that
//!   is expected and not an error.
//! - The public surface of this module is intentionally tiny.

// Non-Windows stub. In this app it mostly exists so the crate still has a
// harmless implementation if someone compiles/tests it on macOS/Linux.
// If your editor says this is inactive on Windows, it is correct.
#[cfg(not(windows))]
mod stub;
// Real implementation used by the packaged Windows helper.
#[cfg(windows)]
mod windows;

// Export the non-Windows stub only for non-Windows builds.
// On Windows this is intentionally inactive.
#[cfg(not(windows))]
pub(crate) use stub::{enumerate_poe_processes, set_process_title, watch_parent_process};
// Export the real Win32 implementation only for Windows builds.
#[cfg(windows)]
pub(crate) use windows::{
    enumerate_poe_processes, set_process_title, watch_parent_process, ParentProcessGuard,
};

#[cfg(not(windows))]
pub(crate) use stub::ParentProcessGuard;
