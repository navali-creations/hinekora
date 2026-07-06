fn main() {
    // Re-run the build script if the app icon changes.
    println!("cargo:rerun-if-changed=../../renderer/assets/logo/windows/icon.ico");

    // `build.rs` runs on the host machine, so use Cargo's target OS variable
    // instead of Rust's `cfg!(windows)` host check.
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os != "windows" {
        return;
    }

    // Metadata such as FileDescription lives in Cargo.toml. This script only
    // attaches the Hinekora icon and asks winresource to compile the resource.
    let mut resource = winresource::WindowsResource::new();
    resource.set_icon("../../renderer/assets/logo/windows/icon.ico");
    resource
        .compile()
        .expect("failed to embed Windows metadata into PoE process helper");
}
