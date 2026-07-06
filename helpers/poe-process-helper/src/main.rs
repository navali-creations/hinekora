//! Native process watcher helper for Hinekora.
//!
//! TypeScript mental model:
//! - This binary is a tiny Node child-process replacement.
//! - Electron spawns it and reads line-delimited JSON from stdout.
//! - It does not write polling JSON to disk.
//! - It polls every second, but emits only on state changes or every 30 seconds
//!   as a heartbeat.

// `mod platform;` is Rust's module import system.
// TS mental model: load `./platform/mod.rs`.
mod platform;
// TS mental model: load `./poe_process.rs`.
mod poe_process;
// TS mental model: load `./protocol.rs`.
mod protocol;

// `std::thread` is Rust's OS-thread helper module.
// `thread::sleep(...)` parks only this helper process's thread.
use std::process;
use std::thread;
use std::time::{Duration, Instant};

use platform::{
    enumerate_poe_processes, set_process_title, watch_parent_process, ParentProcessGuard,
};
use protocol::{create_error_payload, create_state_payload, write_line, write_state};

const HELPER_TITLE: &str = "Hinekora PoE Process Watcher";
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const POLL_INTERVAL: Duration = Duration::from_secs(1);
const STOPPED_OBSERVATIONS_BEFORE_EMIT: usize = 2;

fn main() {
    // `Vec<String>` is `string[]`.
    let args: Vec<String> = std::env::args().collect();
    // `|arg| arg == "--once"` is Rust's closure syntax.
    // TS mental model: `(arg) => arg === "--once"`.
    let once = args.iter().any(|arg| arg == "--once");
    // `&args` borrows the args array. TS mental model: pass readonly args.
    // `unwrap_or` is like `?? HELPER_TITLE`.
    let title = parse_arg_value(&args, "--title").unwrap_or(HELPER_TITLE);

    set_process_title(title);

    if once {
        write_once();
        return;
    }

    // `--parent-pid` is Electron's `process.pid`.
    // If Electron asks for parent tracking and Windows refuses the handle, exit
    // instead of running without shutdown protection.
    let parent_process = match resolve_parent_process(&args) {
        Ok(process) => process,
        Err(error) => {
            let _ = write_line(&create_error_payload(&error));
            eprintln!("{error}");
            process::exit(1);
        }
    };

    watch_forever(parent_process.as_ref());
}

fn write_once() {
    // `match` on Result is like:
    // const result = enumeratePoeProcesses();
    // if (result.ok) { ... } else { ... }
    match enumerate_poe_processes() {
        Ok(processes) => {
            // `if let Err(error)` means run this only when write_state failed.
            if let Err(error) = write_state(&processes) {
                eprintln!("{error}");
            }
        }
        Err(error) => {
            if let Err(write_error) = write_line(&create_error_payload(&error)) {
                eprintln!("{write_error}");
            }
        }
    }
}

fn watch_forever(parent_process: Option<&ParentProcessGuard>) {
    // `mut` means reassignment is allowed, like `let` in TS.
    let mut last_state = String::new();
    let mut next_heartbeat = Instant::now() + HEARTBEAT_INTERVAL;
    let mut stopped_observations = 0usize;

    loop {
        // TS mental model: `if (parentProcess && !parentProcess.isRunning()) return;`
        if parent_process.is_some_and(|process| !process.is_parent_running()) {
            return;
        }

        let processes = match enumerate_poe_processes() {
            Ok(processes) => processes,
            Err(error) => {
                let _ = write_line(&create_error_payload(&error));
                return;
            }
        };

        let state = create_state_payload(&processes);
        let is_stopped_state = !processes.iter().any(|process| process.game.is_some());
        let now = Instant::now();

        // Rust owns the one-miss stop guard. Electron receives only states that
        // this helper has already decided are stable enough to publish.
        if !is_stopped_state {
            stopped_observations = 0;
        }

        let should_emit_state = state != last_state
            && (last_state.is_empty() || !is_stopped_state || {
                stopped_observations += 1;
                stopped_observations >= STOPPED_OBSERVATIONS_BEFORE_EMIT
            });

        if should_emit_state {
            if write_line(&state).is_err() {
                return;
            }
            last_state = state;
            stopped_observations = 0;
            next_heartbeat = now + HEARTBEAT_INTERVAL;
        } else if now >= next_heartbeat {
            if write_line(r#"{"type":"heartbeat"}"#).is_err() {
                return;
            }
            next_heartbeat = now + HEARTBEAT_INTERVAL;
        }

        // This sleep is not like blocking the JS event loop.
        // It suspends only this helper's own OS thread between scans.
        thread::sleep(POLL_INTERVAL);
    }
}

// `<'a>` is a lifetime annotation. TS has GC, so there is no direct equivalent.
// It tells Rust the returned string reference cannot outlive the input args.
// `&[String]` is a borrowed read-only string array.
// `Option<&str>` is like `string | null`.
fn parse_arg_value<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    // `windows(2)` yields overlapping pairs: [currentArg, nextArg].
    args.windows(2)
        // `|window| ...` is `(window) => ...`.
        .find(|window| window[0] == name)
        .map(|window| window[1].as_str())
}

fn parse_process_id(value: &str) -> Option<u32> {
    // Parse a positive process ID. Bad input becomes None, like returning null.
    value
        .parse::<u32>()
        .ok()
        .filter(|process_id| *process_id > 0)
}

fn resolve_parent_process(args: &[String]) -> Result<Option<ParentProcessGuard>, String> {
    let Some(parent_process_id) = parse_arg_value(args, "--parent-pid") else {
        return Ok(None);
    };
    let parent_process_id = parse_process_id(parent_process_id)
        .ok_or_else(|| format!("Invalid parent process id: {parent_process_id}"))?;

    watch_parent_process(parent_process_id).map(Some)
}
