//! Windows process/window enumeration.
//!
//! TypeScript mental model:
//! - This is the only "native interop" file.
//! - HANDLE means "generic Windows-owned token".
//! - HWND means "handle to a window" (`H` = handle, `WND` = window).
//!   TS mental model: both are `unknown` IDs returned by Windows. We pass them
//!   back to Windows APIs but do not inspect them.
//! - `unsafe` blocks are used only where Rust calls raw Win32 APIs.
//! - `*mut T` means a raw writable pointer to T. In TS terms, treat it as an
//!   unsafe native reference, not an object you can safely inspect.
//! - `&mut value` means "pass a writable reference to this value".
//! - `repr(C)` means "store fields in memory exactly like the Windows C struct".
//!
//! Import rules used here:
//! - `std::...` imports Rust's built-in standard library.
//!   TS mental model: built-in Node APIs like `node:fs` or `node:child_process`.
//! - `crate::...` imports code from this Rust package.
//!   TS mental model: local app imports like `~/main/pollers/...`.
//! - `#[link] extern "system"` declares Windows DLL functions. Rust does not
//!   know Win32 APIs by default, so we declare the tiny subset we call.

use std::collections::HashMap;
use std::ffi::c_void;
use std::io;
// `std::mem` is Rust's low-level memory helper module.
// We use it only because Win32 wants a struct with exact byte layout:
// - `size_of::<T>()`: byte size of a native struct.
// - `zeroed::<T>()`: new T with all bytes set to 0, so Windows can fill it in.
use std::mem::{size_of, zeroed};
// `std::thread` provides OS-thread helpers. We only use `thread::sleep` for a
// tiny retry backoff; it sleeps this helper thread, not Electron.
use std::thread;
use std::time::Duration;

// `crate::poe_process` means "import from this package's poe_process.rs file".
// Use `crate::` when importing our Rust modules; use `std::` for Rust built-ins.
use crate::poe_process::{
    canonical_poe_process_name, detect_poe_game_from_window_title,
    is_known_poe_window_title_length, PoeProcess,
};

// `usize` is a non-negative integer sized for the current CPU pointer width.
// TS mental model: use it for lengths, indexes, and buffer sizes.
const PROCESS_SNAPSHOT_RETRIES: usize = 3;
const MAX_PATH: usize = 260;
// Hex literal from Win32 docs. `0x0000_0002` is just decimal 2 written in base16;
// underscores are visual separators. This flag means "snapshot processes".
const TH32CS_SNAPPROCESS: u32 = 0x0000_0002;
// Minimal process right needed by WaitForSingleObject.
const SYNCHRONIZE: u32 = 0x0010_0000;
// WaitForSingleObject returns this when the process is still alive.
const WAIT_TIMEOUT: u32 = 0x0000_0102;
// Win32 returns this exact token when CreateToolhelp32Snapshot fails.
const INVALID_HANDLE_VALUE: Handle = !0 as Handle;

// Win32 type aliases, expanded:
// - BOOL: Windows boolean. 0 is false, any non-zero number is true.
// - DWORD: "double word", a Windows unsigned 32-bit number.
// - HANDLE: generic Windows-owned token/reference.
// - HWND: "handle to window", a Windows-owned token for a window.
// - LPARAM: pointer-sized callback parameter Windows passes through to us.
//
// TS mental model:
// type Bool = number;
// type Dword = number;
// type Handle = unknown;
// type Hwnd = unknown;
// type Lparam = number;
type Bool = i32;
type Dword = u32;
type Handle = *mut c_void;
type Hwnd = *mut c_void;
type Lparam = isize;

// Rust struct equivalent of the Win32 PROCESSENTRY32W struct.
// TS mental model: this is like an interface, except Windows writes bytes
// directly into this exact memory layout.
#[repr(C)]
#[allow(non_snake_case)]
struct ProcessEntry32W {
    // dw = DWORD. Size of this struct in bytes. Windows requires this.
    dw_size: Dword,
    // cnt = count. Legacy usage count; unused here.
    cnt_usage: Dword,
    // th32 = Toolhelp32 snapshot API prefix. This is the process ID.
    th32_process_id: Dword,
    // Legacy/default heap identifier; unused here.
    th32_default_heap_id: usize,
    // Module identifier; unused here.
    th32_module_id: Dword,
    // Number of process threads; unused here.
    cnt_threads: Dword,
    // Parent process ID; unused here.
    th32_parent_process_id: Dword,
    // Base priority class; unused here.
    pc_pri_class_base: i32,
    // Process flags; unused here.
    dw_flags: Dword,
    // sz = string buffer. Executable filename as UTF-16, for example
    // PathOfExileSteam.exe.
    sz_exe_file: [u16; MAX_PATH],
}

// Callback function type for EnumWindows.
// TS mental model: type EnumWindowsProc = (hwnd, lparam) => number.
type EnumWindowsProc = unsafe extern "system" fn(hwnd: Hwnd, lparam: Lparam) -> Bool;

// Link these external function declarations to kernel32.dll.
// `extern "system"` means "these functions are implemented by Windows, not Rust".
#[link(name = "kernel32")]
extern "system" {
    // Why: every successful CreateToolhelp32Snapshot returns a HANDLE that must
    // be released. This is the cleanup function.
    fn CloseHandle(handle: Handle) -> Bool;
    // Why: gives us a point-in-time snapshot of the Windows process table.
    // This replaces tasklist/WMI/PowerShell.
    fn CreateToolhelp32Snapshot(flags: Dword, process_id: Dword) -> Handle;
    // Why: reads the first process from the snapshot into ProcessEntry32W.
    fn Process32FirstW(snapshot: Handle, entry: *mut ProcessEntry32W) -> Bool;
    // Why: moves through the rest of the process snapshot one process at a time.
    fn Process32NextW(snapshot: Handle, entry: *mut ProcessEntry32W) -> Bool;
    // Why: opens a lightweight wait handle to Electron so this helper can exit
    // if the parent process is force-killed.
    fn OpenProcess(desired_access: Dword, inherit_handle: Bool, process_id: Dword) -> Handle;
    // Why: makes the helper easier to identify in process tools.
    fn SetConsoleTitleW(title: *const u16) -> Bool;
    // Why: checks whether the parent process handle has been signaled.
    fn WaitForSingleObject(handle: Handle, milliseconds: Dword) -> Dword;
}

// Link these external function declarations to user32.dll.
#[link(name = "user32")]
extern "system" {
    // Why: loops over visible top-level windows so we can read their titles.
    fn EnumWindows(enum_func: Option<EnumWindowsProc>, lparam: Lparam) -> Bool;
    // Why: tells us how large a title buffer to allocate before reading it.
    fn GetWindowTextLengthW(hwnd: Hwnd) -> i32;
    // Why: reads the actual window title text.
    fn GetWindowTextW(hwnd: Hwnd, text: *mut u16, max_count: i32) -> i32;
    // Why: connects a window title back to the process ID that owns it.
    fn GetWindowThreadProcessId(hwnd: Hwnd, process_id: *mut Dword) -> Dword;
    // Why: ignores hidden/background windows that are not useful game windows.
    fn IsWindowVisible(hwnd: Hwnd) -> Bool;
}

// Small cleanup wrapper. Holding SnapshotHandle means "close this handle when
// the wrapper leaves scope".
struct SnapshotHandle(Handle);

// `Drop` is Rust's deterministic cleanup hook.
// TS mental model: a finally block that Rust runs automatically at scope exit.
impl Drop for SnapshotHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

// RAII wrapper around Electron's process handle.
// TS mental model: an object with a `dispose()` that Rust calls automatically.
pub(crate) struct ParentProcessGuard(Handle);

impl ParentProcessGuard {
    pub(crate) fn is_parent_running(&self) -> bool {
        // `0` means "do not wait"; just ask Windows for the current state.
        let wait_result = unsafe { WaitForSingleObject(self.0, 0) };

        wait_result == WAIT_TIMEOUT
    }
}

impl Drop for ParentProcessGuard {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

// Mutable object passed to EnumWindows through the raw lparam token.
struct WindowEnumContext {
    titles_by_pid: HashMap<u32, Vec<String>>,
}

pub(crate) fn set_process_title(title: &str) {
    let wide_title = to_wide_null(title);
    unsafe {
        SetConsoleTitleW(wide_title.as_ptr());
    }
}

pub(crate) fn watch_parent_process(parent_process_id: u32) -> Result<ParentProcessGuard, String> {
    if parent_process_id == 0 {
        return Err("Parent process id must be greater than 0".to_owned());
    }

    // SYNCHRONIZE gives only wait rights. We do not read memory or inspect the
    // parent process; we only ask Windows whether it is still alive.
    let handle = unsafe { OpenProcess(SYNCHRONIZE, 0, parent_process_id) };
    if handle.is_null() {
        return Err(format!(
            "Parent process watch failed for PID {}: {}",
            parent_process_id,
            io::Error::last_os_error(),
        ));
    }

    Ok(ParentProcessGuard(handle))
}

pub(crate) fn enumerate_poe_processes() -> Result<Vec<PoeProcess>, String> {
    // `?` means: if this returns Err, return that Err from this function.
    let mut processes = enumerate_matching_processes()?;
    if processes.is_empty() {
        return Ok(processes);
    }

    let titles_by_pid = enumerate_window_titles_by_pid();
    // `&mut processes` means each loop item can be edited in place.
    for process in &mut processes {
        // `if let Some(titles)` means "if the map lookup found a value".
        if let Some(titles) = titles_by_pid.get(&process.pid) {
            process.window_title = choose_window_title(titles);
            process.game = detect_poe_game_from_window_title(&process.window_title);
        }
    }

    Ok(processes)
}

fn enumerate_matching_processes() -> Result<Vec<PoeProcess>, String> {
    let snapshot = create_process_snapshot()?;
    // Keep this guard alive until the function returns; Drop closes the handle.
    let _snapshot_guard = SnapshotHandle(snapshot);
    // Win32 requires a zero-filled struct before it writes process data into it.
    let mut entry = unsafe { zeroed::<ProcessEntry32W>() };
    entry.dw_size = size_of::<ProcessEntry32W>() as Dword;

    let mut processes = Vec::new();
    // `&mut entry` lets Windows write into our ProcessEntry32W value.
    let has_first_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    if !has_first_entry {
        return Err(format!(
            "Process32FirstW failed: {}",
            io::Error::last_os_error()
        ));
    }

    loop {
        let process_name = wide_null_to_string(&entry.sz_exe_file);
        if let Some(canonical_name) = canonical_poe_process_name(&process_name) {
            processes.push(PoeProcess {
                pid: entry.th32_process_id,
                process_name: canonical_name.to_owned(),
                window_title: String::new(),
                game: None,
            });
        }

        if unsafe { Process32NextW(snapshot, &mut entry) } == 0 {
            break;
        }
    }

    Ok(processes)
}

fn create_process_snapshot() -> Result<Handle, String> {
    // `0..PROCESS_SNAPSHOT_RETRIES` is like:
    // for (let attempt = 0; attempt < PROCESS_SNAPSHOT_RETRIES; attempt++)
    for attempt in 0..PROCESS_SNAPSHOT_RETRIES {
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot != INVALID_HANDLE_VALUE {
            return Ok(snapshot);
        }
        if attempt + 1 < PROCESS_SNAPSHOT_RETRIES {
            // This sleep parks only the helper's current OS thread for 10ms.
            // It does not block Electron and it does not spin CPU.
            thread::sleep(Duration::from_millis(10));
        }
    }

    Err(format!(
        "CreateToolhelp32Snapshot failed: {}",
        io::Error::last_os_error()
    ))
}

fn enumerate_window_titles_by_pid() -> HashMap<u32, Vec<String>> {
    let mut context = WindowEnumContext {
        titles_by_pid: HashMap::new(),
    };

    let ok = unsafe {
        // Convert our writable context reference into a raw pointer token so
        // Windows can pass it back to enum_window for each window.
        EnumWindows(Some(enum_window), &mut context as *mut _ as Lparam)
    };
    if ok == 0 {
        eprintln!("EnumWindows failed: {}", io::Error::last_os_error());
    }

    context.titles_by_pid
}

// Windows calls this once per top-level window.
// Return 1 to continue enumeration; return 0 to stop.
unsafe extern "system" fn enum_window(hwnd: Hwnd, lparam: Lparam) -> Bool {
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }

    let text_length = GetWindowTextLengthW(hwnd);
    if text_length <= 0 {
        return 1;
    }
    if !is_known_poe_window_title_length(text_length as usize) {
        return 1;
    }

    let mut process_id = 0;
    // Windows writes the owner PID into process_id through this mutable reference.
    GetWindowThreadProcessId(hwnd, &mut process_id);
    if process_id == 0 {
        return 1;
    }

    // `vec![0u16; n]` creates an array of n UTF-16 zero values.
    let mut buffer = vec![0u16; text_length as usize + 1];
    // `as_mut_ptr()` gives Windows a raw pointer to write the title into.
    let copied = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
    if copied <= 0 {
        return 1;
    }

    let title = String::from_utf16_lossy(&buffer[..copied as usize])
        .trim()
        .to_owned();
    if title.is_empty() {
        return 1;
    }

    // Convert the lparam token back into the WindowEnumContext pointer we passed
    // to EnumWindows. This is unsafe because Rust cannot verify the token.
    let context = &mut *(lparam as *mut WindowEnumContext);
    context
        .titles_by_pid
        .entry(process_id)
        .or_default()
        .push(title);

    1
}

fn choose_window_title(titles: &[String]) -> String {
    titles
        .iter()
        // `|title| ...` is Rust closure syntax, like `(title) => ...`.
        .find(|title| is_path_of_exile_title(title))
        .or_else(|| titles.first())
        .cloned()
        .unwrap_or_default()
}

fn is_path_of_exile_title(title: &str) -> bool {
    detect_poe_game_from_window_title(title).is_some()
}

fn wide_null_to_string(value: &[u16]) -> String {
    let length = value
        .iter()
        // `|character| ...` is closure syntax; `*character` reads the referenced
        // u16 value from the iterator item.
        .position(|character| *character == 0)
        .unwrap_or(value.len());

    String::from_utf16_lossy(&value[..length])
}

fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_path_of_exile_window_titles() {
        assert_eq!(
            choose_window_title(&["Steam".to_owned(), "Path of Exile 2".to_owned(),]),
            "Path of Exile 2",
        );
    }
}
