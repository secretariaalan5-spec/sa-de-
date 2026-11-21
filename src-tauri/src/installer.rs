#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x08000000;

const APP_EXE_BYTES: &[u8] = include_bytes!("../target/release/saude-plus-desktop.exe");
const WEBVIEW2_DLL_BYTES: &[u8] = include_bytes!("../target/release/WebView2Loader.dll");
const ICON_ICO_BYTES: &[u8] = include_bytes!("../icons/icon.ico");
const ICON_PNG_BYTES: &[u8] = include_bytes!("../icons/icon.png");

fn get_base_dir() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join("SaudePlus")
}

fn main() {
    let base_dir = get_base_dir();
    let _ = fs::create_dir_all(&base_dir);

    let exe_path = base_dir.join("SaudePlus.exe");
    let dll_path = base_dir.join("WebView2Loader.dll");
    let ico_path = base_dir.join("saude-plus-icon.ico");
    let png_path = base_dir.join("saude-plus-icon.png");

    let forward_args: Vec<String> = env::args().skip(1).collect();
    let is_custom_profile = forward_args.iter().any(|a| a.starts_with("--profile"));

    if !is_custom_profile {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "SaudePlus.exe", "/IM", "saude-plus-desktop.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        thread::sleep(Duration::from_millis(250));
    }

    let _ = fs::write(&dll_path, WEBVIEW2_DLL_BYTES);
    let _ = fs::write(&ico_path, ICON_ICO_BYTES);
    let _ = fs::write(&png_path, ICON_PNG_BYTES);
    let _ = fs::write(&exe_path, APP_EXE_BYTES);

    let mut launch_args = forward_args;
    if !is_custom_profile {
        launch_args.push("--installed".to_string());
    }

    let _ = Command::new(&exe_path)
        .args(&launch_args)
        .current_dir(&base_dir)
        .spawn();

    // Cria atalho na Área de Trabalho, Menu Iniciar e fixa/atualiza na Barra de Tarefas do Windows
    let exe_str = exe_path.to_string_lossy().to_string();
    let ico_str = ico_path.to_string_lossy().to_string();
    let ps_script = format!(
        r#"$WshShell = New-Object -ComObject WScript.Shell;
$DesktopPath = [Environment]::GetFolderPath('Desktop');
$StartMenuPath = [Environment]::GetFolderPath('Programs');
$TaskBarPath = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar';

foreach ($dir in @($DesktopPath, $StartMenuPath)) {{
  if (Test-Path $dir) {{
    $Shortcut = $WshShell.CreateShortcut((Join-Path $dir 'Saúde+.lnk'));
    $Shortcut.TargetPath = '{exe}';
    $Shortcut.IconLocation = '{ico},0';
    $Shortcut.Description = 'Saúde+ - Gestão de Escalas';
    $Shortcut.Save();
  }}
}}

if (Test-Path $TaskBarPath) {{
  foreach ($name in @('Saúde+ - Gestão de Escalas.lnk', 'Saúde+ - Gestão de Escalas (1).lnk', 'Saúde+ - Gestão de Escalas (3).lnk')) {{
    $s = $WshShell.CreateShortcut((Join-Path $TaskBarPath $name));
    $s.TargetPath = '{exe}';
    $s.Arguments = '';
    $s.IconLocation = '{ico},0';
    $s.Description = 'Saúde+ - Gestão de Escalas';
    $s.Save();
  }}
}}"#,
        exe = exe_str.replace('\'', "''"),
        ico = ico_str.replace('\'', "''")
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}
