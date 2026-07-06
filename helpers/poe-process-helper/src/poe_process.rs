//! Shared PoE process model.
//!
//! TypeScript mental model:
//! - `enum PoeGame` is closest to a string union: `"poe1" | "poe2"`.
//! - `struct PoeProcess` is closest to an `interface PoeProcess`.
//! - `Vec<PoeProcess>` elsewhere is closest to `PoeProcess[]`.
//! - `Option<T>` is closest to `T | null`.

// `[&str; 2]` is an array of exactly two read-only strings.
// TS mental model: readonly [string, string].
pub(crate) const POE_PROCESS_NAMES: [&str; 2] = ["PathOfExileSteam.exe", "PathOfExile.exe"];
pub(crate) const POE1_WINDOW_TITLE: &str = "Path of Exile";
pub(crate) const POE2_WINDOW_TITLE: &str = "Path of Exile 2";

const POE1_WINDOW_TITLE_NORMALIZED: &str = "path of exile";
const POE2_WINDOW_TITLE_NORMALIZED: &str = "path of exile 2";

// Rust enum with two possible values.
// TS mental model: type PoeGame = "poe1" | "poe2".
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum PoeGame {
    Poe1,
    Poe2,
}

impl PoeGame {
    // Fixed order for JSON output. TS mental model: const games = ["poe1", "poe2"].
    pub(crate) const ALL: [PoeGame; 2] = [PoeGame::Poe1, PoeGame::Poe2];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            PoeGame::Poe1 => "poe1",
            PoeGame::Poe2 => "poe2",
        }
    }
}

// `derive(...)` asks Rust to auto-generate common behavior:
// clone, debug printing, equality, etc.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct PoeProcess {
    pub(crate) pid: u32,
    pub(crate) process_name: String,
    pub(crate) window_title: String,
    pub(crate) game: Option<PoeGame>,
}

pub(crate) fn canonical_poe_process_name(process_name: &str) -> Option<&'static str> {
    POE_PROCESS_NAMES
        .iter()
        // `.copied()` turns `&&str` from the iterator into `&str`.
        .copied()
        // `|candidate| ...` is Rust's `(candidate) => ...` syntax.
        .find(|candidate| candidate.eq_ignore_ascii_case(process_name))
}

pub(crate) fn detect_poe_game_from_window_title(value: &str) -> Option<PoeGame> {
    detect_exact_poe_window_title(&normalize_window_title(value))
}

pub(crate) fn is_known_poe_window_title_length(length: usize) -> bool {
    length == POE1_WINDOW_TITLE.len() || length == POE2_WINDOW_TITLE.len()
}

fn detect_exact_poe_window_title(value: &str) -> Option<PoeGame> {
    match value {
        POE2_WINDOW_TITLE_NORMALIZED => Some(PoeGame::Poe2),
        POE1_WINDOW_TITLE_NORMALIZED => Some(PoeGame::Poe1),
        _ => None,
    }
}

fn normalize_window_title(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

#[cfg(test)]
// Test-only module. TS mental model: a colocated `describe`.
mod tests {
    use super::*;

    #[test]
    fn resolves_only_known_process_names() {
        assert_eq!(
            canonical_poe_process_name("pathofexilesteam.exe"),
            Some("PathOfExileSteam.exe"),
        );
        assert_eq!(canonical_poe_process_name("PathOfExile_x64Steam.exe"), None);
    }

    #[test]
    fn resolves_game_from_window_title() {
        assert_eq!(
            detect_poe_game_from_window_title("Path of Exile"),
            Some(PoeGame::Poe1),
        );
        assert_eq!(
            detect_poe_game_from_window_title("Path of Exile 2"),
            Some(PoeGame::Poe2),
        );
        assert_eq!(
            detect_poe_game_from_window_title("  Path   of   Exile  "),
            Some(PoeGame::Poe1),
        );
        assert_eq!(
            detect_poe_game_from_window_title("Path of Exile 2: renderer"),
            None,
        );
        assert_eq!(detect_poe_game_from_window_title("Steam"), None);
    }

    #[test]
    fn accepts_only_known_window_title_lengths() {
        assert!(is_known_poe_window_title_length(POE1_WINDOW_TITLE.len()));
        assert!(is_known_poe_window_title_length(POE2_WINDOW_TITLE.len()));
        assert!(!is_known_poe_window_title_length(
            "Path of Exile 2: renderer".len(),
        ));
    }
}
