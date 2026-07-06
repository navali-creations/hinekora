//! Stdout JSON protocol used by Electron.
//!
//! TypeScript mental model:
//! - This file is like a small serializer module.
//! - It returns strings such as `{"type":"state","states":[...]}`.
//! - `write_line` sends one JSON message through stdout and flushes it.
//! - Nothing here writes to disk.

use std::io::{self, Write};

use crate::poe_process::{PoeGame, PoeProcess};

// `&[PoeProcess]` is a borrowed read-only PoeProcess array.
// `io::Result<()>` means success returns nothing; failure returns an IO error.
pub(crate) fn write_state(processes: &[PoeProcess]) -> io::Result<()> {
    write_line(&create_state_payload(processes))
}

pub(crate) fn write_line(line: &str) -> io::Result<()> {
    // `mut` because writing advances internal stdout state.
    let mut stdout = io::stdout().lock();
    // `?` means return immediately if the write failed.
    stdout.write_all(line.as_bytes())?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}

pub(crate) fn create_state_payload(processes: &[PoeProcess]) -> String {
    // `mut` because we append to the string.
    let mut payload = String::from(r#"{"type":"state","states":["#);

    // Emit both known games every time. Electron does not infer missing games.
    for (index, game) in PoeGame::ALL.iter().enumerate() {
        if index > 0 {
            payload.push(',');
        }

        let process = processes.iter().find(|process| process.game == Some(*game));
        write_game_state(&mut payload, *game, process);
    }

    payload.push_str("]}");
    payload
}

pub(crate) fn create_error_payload(message: &str) -> String {
    let mut payload = String::from(r#"{"type":"error","message":""#);
    payload.push_str(&escape_json_string(message));
    payload.push_str(r#""}"#);
    payload
}

fn escape_json_string(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());

    // `.chars()` iterates Unicode characters.
    for character in value.chars() {
        // `match` is a switch expression.
        match character {
            '"' => escaped.push_str(r#"\""#),
            '\\' => escaped.push_str(r#"\\"#),
            '\n' => escaped.push_str(r#"\n"#),
            '\r' => escaped.push_str(r#"\r"#),
            '\t' => escaped.push_str(r#"\t"#),
            '\u{08}' => escaped.push_str(r#"\b"#),
            '\u{0c}' => escaped.push_str(r#"\f"#),
            // `if` here is a guard on this switch case.
            character if character < '\u{20}' => {
                escaped.push_str(&format!(r#"\u{:04x}"#, character as u32));
            }
            character => escaped.push(character),
        }
    }

    escaped
}

fn write_game_state(payload: &mut String, game: PoeGame, process: Option<&PoeProcess>) {
    payload.push_str(r#"{"game":""#);
    payload.push_str(game.as_str());
    payload.push_str(r#"","isRunning":"#);

    if let Some(process) = process {
        payload.push_str("true");
        payload.push_str(r#","pid":"#);
        payload.push_str(&process.pid.to_string());
        payload.push_str(r#","processName":""#);
        payload.push_str(&escape_json_string(&process.process_name));
        payload.push_str(r#"","windowTitle":""#);
        payload.push_str(&escape_json_string(&process.window_title));
        payload.push('"');
    } else {
        payload.push_str("false");
        payload.push_str(r#","processName":"""#);
    }

    payload.push('}');
}

#[cfg(test)]
// Test-only module. TS mental model: a colocated `describe`.
mod tests {
    use super::*;

    #[test]
    fn escapes_json_strings() {
        assert_eq!(
            escape_json_string("Path \"of\" Exile\\2\n"),
            r#"Path \"of\" Exile\\2\n"#,
        );
    }

    #[test]
    fn creates_compact_state_payload() {
        let payload = create_state_payload(&[PoeProcess {
            pid: 42,
            process_name: "PathOfExileSteam.exe".to_owned(),
            window_title: "Path of Exile 2".to_owned(),
            game: Some(PoeGame::Poe2),
        }]);

        assert_eq!(
            payload,
            r#"{"type":"state","states":[{"game":"poe1","isRunning":false,"processName":""},{"game":"poe2","isRunning":true,"pid":42,"processName":"PathOfExileSteam.exe","windowTitle":"Path of Exile 2"}]}"#,
        );
    }

    #[test]
    fn creates_compact_error_payload() {
        assert_eq!(
            create_error_payload("snapshot \"failed\""),
            r#"{"type":"error","message":"snapshot \"failed\""}"#,
        );
    }
}
