// Oculta a janela de console preta no Windows em modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration as StdDuration;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use windows::{
    runtime::HSTRING,
    Data::Xml::Dom::XmlDocument,
    UI::Notifications::{ToastNotification, ToastNotificationManager},
};
use winrt_notification::{Duration, IconCrop, Sound, Toast};
use xml::escape::escape_str_attribute;

const APP_URL: &str = "https://saude-gules.vercel.app";
const APP_AUMID: &str = "com.saudeplus.escalas.oficial";
const NOTIFY_PREFIX: &str = "__SAUDE_NOTIFY__:";
const BADGE_PREFIX: &str = "__SAUDE_BADGE__:";
const SAVE_ACCOUNTS_PREFIX: &str = "__SAUDE_SAVE_ACCOUNTS__:";
const CREATE_NO_WINDOW: u32 = 0x08000000;
const EMBEDDED_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");
const EMBEDDED_ICON_ICO: &[u8] = include_bytes!("../icons/icon.ico");

/// Verifica se o processo foi invocado pelo clique em uma notificação do Windows (`saudeplus://nav/<profile>/<rota>`)
fn parse_protocol_launch_arg() -> Option<(u16, String)> {
    for arg in std::env::args().skip(1) {
        if let Some(rest) = arg.strip_prefix("saudeplus://nav/") {
            let trimmed = rest.trim_matches('/');
            let mut parts = trimmed.splitn(2, '/');
            let prof = parts
                .next()
                .and_then(|p| p.parse::<u16>().ok())
                .unwrap_or(1);
            let route = match parts.next() {
                Some(r) if !r.is_empty() => format!("/{}", r),
                _ => "/".to_string(),
            };
            return Some((prof, route));
        }
    }
    None
}

fn get_profile_id() -> u16 {
    if let Some((prof, _)) = parse_protocol_launch_arg() {
        return prof;
    }
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if let Some(val) = args[i].strip_prefix("--profile=") {
            if let Ok(num) = val.trim().parse::<u16>() {
                if num >= 1 && num <= 20 {
                    return num;
                }
            }
        } else if args[i] == "--profile" {
            if let Some(next) = args.get(i + 1) {
                if let Ok(num) = next.trim().parse::<u16>() {
                    if num >= 1 && num <= 20 {
                        return num;
                    }
                }
            }
        }
    }
    1
}

fn get_base_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("SaudePlus")
}

fn get_saved_accounts_path() -> PathBuf {
    get_base_dir().join("saved_accounts.json")
}

fn read_saved_accounts_json() -> serde_json::Value {
    let path = get_saved_accounts_path();
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if val.is_array() {
                return val;
            }
        }
    }
    serde_json::json!([])
}

fn merge_and_save_accounts(incoming: &serde_json::Value) -> serde_json::Value {
    let mut existing = read_saved_accounts_json()
        .as_array()
        .cloned()
        .unwrap_or_default();

    if let Some(inc_arr) = incoming.as_array() {
        for item in inc_arr {
            if let Some(email) = item.get("email").and_then(|v| v.as_str()) {
                existing.retain(|x| x.get("email").and_then(|v| v.as_str()) != Some(email));
                existing.insert(0, item.clone());
            }
        }
    }

    existing.truncate(10);
    let out = serde_json::Value::Array(existing);
    if let Ok(serialized) = serde_json::to_string(&out) {
        let _ = std::fs::write(get_saved_accounts_path(), serialized);
    }
    out
}

/// Mapa de pixels 5x7 para desenhar números nítidos no badge estilo WhatsApp
fn digit_bitmap(ch: char) -> [u8; 7] {
    match ch {
        '0' => [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
        '1' => [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
        '2' => [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
        '3' => [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
        '4' => [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
        '5' => [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
        '6' => [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
        '7' => [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
        '8' => [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
        '9' => [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
        '+' => [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
        _ => [0; 7],
    }
}

/// Desenha um círculo vermelho estilo WhatsApp (#EF4444) com borda branca e o número centralizado
fn draw_badge_circle_onto_rgba(
    rgba: &mut [u8],
    width: u32,
    height: u32,
    cx: f32,
    cy: f32,
    radius: f32,
    count: u32,
) {
    let label = if count > 9 {
        "9+".to_string()
    } else {
        count.to_string()
    };

    let border_r = radius;
    let inner_r = radius * 0.86;

    for y in 0..height {
        for x in 0..width {
            let dx = (x as f32 + 0.5) - cx;
            let dy = (y as f32 + 0.5) - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist <= border_r {
                let idx = ((y * width + x) * 4) as usize;
                if dist <= inner_r {
                    // Vermelho vibrante estilo WhatsApp/iOS (#EF4444)
                    rgba[idx] = 239;
                    rgba[idx + 1] = 68;
                    rgba[idx + 2] = 68;
                    rgba[idx + 3] = 255;
                } else {
                    // Borda branca nítida
                    rgba[idx] = 255;
                    rgba[idx + 1] = 255;
                    rgba[idx + 2] = 255;
                    rgba[idx + 3] = 255;
                }
            }
        }
    }

    let chars: Vec<char> = label.chars().collect();
    let num_chars = chars.len() as i32;
    let scale = ((radius * 1.15) / 7.0).max(1.0).round() as i32;
    let glyph_w = 5 * scale;
    let glyph_h = 7 * scale;
    let gap = (scale / 2).max(1);
    let total_w = num_chars * glyph_w + (num_chars - 1) * gap;

    let start_x = (cx.round() as i32) - (total_w / 2);
    let start_y = (cy.round() as i32) - (glyph_h / 2);

    for (ci, ch) in chars.into_iter().enumerate() {
        let bmp = digit_bitmap(ch);
        let gx0 = start_x + (ci as i32) * (glyph_w + gap);
        for row in 0..7i32 {
            let bits = bmp[row as usize];
            for col in 0..5i32 {
                if (bits & (1 << (4 - col))) != 0 {
                    for sy in 0..scale {
                        for sx in 0..scale {
                            let px = gx0 + col * scale + sx;
                            let py = start_y + row * scale + sy;
                            if px >= 0 && px < width as i32 && py >= 0 && py < height as i32 {
                                let idx = (((py as u32) * width + (px as u32)) * 4) as usize;
                                rgba[idx] = 255;
                                rgba[idx + 1] = 255;
                                rgba[idx + 2] = 255;
                                rgba[idx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Cria o ícone overlay 64x64 para a Barra de Tarefas do Windows e o ícone com badge para a bandeja
fn update_app_badge(
    app: &tauri::AppHandle,
    tray_holder: &Arc<Mutex<Option<TrayIcon>>>,
    profile_id: u16,
    count: u32,
) {
    let app_clone = app.clone();
    let tray_clone = tray_holder.clone();
    let _ = app.run_on_main_thread(move || {
        let base_img = match Image::from_bytes(EMBEDDED_ICON_PNG) {
            Ok(img) => img,
            Err(_) => return,
        };

        let base_title = if profile_id == 1 {
            "Saúde+ Escalas".to_string()
        } else {
            format!("Saúde+ Escalas (Conta {})", profile_id)
        };

        if count == 0 {
            if let Some(window) = app_clone.get_webview_window("main") {
                let _ = window.set_overlay_icon(None);
                let _ = window.set_icon(base_img.clone());
                let _ = window.set_title(&base_title);
            }
            if let Ok(guard) = tray_clone.lock() {
                if let Some(ref tray) = *guard {
                    let _ = tray.set_icon(Some(base_img));
                    let _ = tray.set_tooltip(Some(&base_title));
                }
            }
            return;
        }

        // 1. Ícone Overlay 32x32 nítido exclusivo para a Barra de Tarefas do Windows (canto inferior direito igual WhatsApp)
        let ov_w = 32u32;
        let ov_h = 32u32;
        let mut ov_rgba = vec![0u8; (ov_w * ov_h * 4) as usize];
        draw_badge_circle_onto_rgba(&mut ov_rgba, ov_w, ov_h, 16.0, 16.0, 15.0, count);
        let overlay_img = Image::new_owned(ov_rgba, ov_w, ov_h);

        // 2. Ícone da aplicação + bandeja com o círculo vermelho grande e legível no canto inferior direito
        let w = base_img.width();
        let h = base_img.height();
        let mut app_rgba = base_img.rgba().to_vec();
        let r = (w.min(h) as f32) * 0.36;
        let cx = (w as f32) - r - 2.0;
        let cy = (h as f32) - r - 2.0;
        draw_badge_circle_onto_rgba(&mut app_rgba, w, h, cx, cy, r, count);
        let badged_app_img = Image::new_owned(app_rgba, w, h);

        let badged_title = format!("({}) {}", count, base_title);

        if let Some(window) = app_clone.get_webview_window("main") {
            let _ = window.set_overlay_icon(Some(overlay_img));
            let _ = window.set_icon(badged_app_img.clone());
            let _ = window.set_badge_count(Some(count as i64));
            let _ = window.set_title(&badged_title);
        }
        if let Ok(guard) = tray_clone.lock() {
            if let Some(ref tray) = *guard {
                let _ = tray.set_icon(Some(badged_app_img));
                let _ = tray.set_tooltip(Some(&format!(
                    "{} — {} notificação(ões) não lida(s)",
                    base_title, count
                )));
            }
        }
    });
}

fn ensure_windows_app_identity_and_install(profile_id: u16) -> Option<PathBuf> {
    let base_dir = get_base_dir();
    let _ = std::fs::create_dir_all(&base_dir);

    let icon_png_path = base_dir.join("saude-plus-icon.png");
    let icon_ico_path = base_dir.join("saude-plus-icon.ico");
    let _ = std::fs::write(&icon_png_path, EMBEDDED_ICON_PNG);
    let _ = std::fs::write(&icon_ico_path, EMBEDDED_ICON_ICO);

    let installed_exe_path = base_dir.join("SaudePlus.exe");
    if let Ok(current_exe) = std::env::current_exe() {
        let same_path = current_exe
            .canonicalize()
            .ok()
            .zip(installed_exe_path.canonicalize().ok())
            .map(|(a, b)| a == b)
            .unwrap_or(false);

        if !same_path {
            let _ = std::fs::copy(&current_exe, &installed_exe_path);
        }
    }

    let reg_key = format!(r"HKCU\Software\Classes\AppUserModelId\{}", APP_AUMID);
    let icon_png_str = icon_png_path.to_string_lossy().to_string();

    let _ = Command::new("reg")
        .args([
            "add",
            &reg_key,
            "/v",
            "DisplayName",
            "/t",
            "REG_SZ",
            "/d",
            "Saúde+ Escalas",
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = Command::new("reg")
        .args([
            "add",
            &reg_key,
            "/v",
            "IconUri",
            "/t",
            "REG_SZ",
            "/d",
            &icon_png_str,
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = Command::new("reg")
        .args([
            "add",
            &reg_key,
            "/v",
            "IconBackgroundColor",
            "/t",
            "REG_SZ",
            "/d",
            "FF1E5BF0",
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    // Registra o protocolo `saudeplus://` no HKCU (sem precisar de admin) para que
    // ao clicar na notificação do Windows o app abra direto na aba do que foi notificado!
    if installed_exe_path.exists() {
        let exe_str = installed_exe_path.to_string_lossy().to_string();
        let proto_cmd = format!("\"{}\" \"%1\"", exe_str);

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Classes\saudeplus",
                "/ve",
                "/t",
                "REG_SZ",
                "/d",
                "URL:SaudePlus Protocol",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Classes\saudeplus",
                "/v",
                "URL Protocol",
                "/t",
                "REG_SZ",
                "/d",
                "",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Classes\saudeplus\shell\open\command",
                "/ve",
                "/t",
                "REG_SZ",
                "/d",
                &proto_cmd,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    if profile_id == 1 && installed_exe_path.exists() {
        let exe_str = installed_exe_path.to_string_lossy().to_string();
        let ico_str = icon_ico_path.to_string_lossy().to_string();

        let run_cmd = format!("\"{}\"", exe_str);
        let _ = Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "SaudePlusDesktop",
                "/t",
                "REG_SZ",
                "/d",
                &run_cmd,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        let base_str = base_dir.to_string_lossy().to_string();
        let ps_script = format!(
            r#"$WshShell = New-Object -ComObject WScript.Shell;
$DesktopPath = [Environment]::GetFolderPath('Desktop');
$StartMenuPath = [Environment]::GetFolderPath('Programs');
$ChromeApps1 = Join-Path $StartMenuPath 'apps do Chrome';
$ChromeApps2 = Join-Path $StartMenuPath 'Aplicativos do Chrome';
$ChromeApps3 = Join-Path $StartMenuPath 'Chrome Apps';
$TaskBarPath = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar';

foreach ($dir in @($DesktopPath, $StartMenuPath, $ChromeApps1, $ChromeApps2, $ChromeApps3)) {{
  if (Test-Path $dir) {{
    Get-ChildItem -Path $dir -Filter 'Saúde+*.lnk' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -notlike '*Portal*' }} | ForEach-Object {{
      $s = $WshShell.CreateShortcut($_.FullName);
      $s.TargetPath = '{exe}';
      $s.WorkingDirectory = '{base}';
      $s.Arguments = '';
      $s.IconLocation = '{ico},0';
      $s.Description = 'Saúde+ Escalas';
      $s.Save();
    }};
  }}
}}

foreach ($dir in @($DesktopPath, $StartMenuPath)) {{
  if (Test-Path $dir) {{
    $Shortcut = $WshShell.CreateShortcut((Join-Path $dir 'Saúde+ Escalas.lnk'));
    $Shortcut.TargetPath = '{exe}';
    $Shortcut.WorkingDirectory = '{base}';
    $Shortcut.IconLocation = '{ico},0';
    $Shortcut.Description = 'Saúde+ Escalas';
    $Shortcut.Save();
  }}
}}

if (Test-Path $TaskBarPath) {{
  Get-ChildItem -Path $TaskBarPath -Filter 'Saúde+*.lnk' -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -notlike '*Portal*' }} | ForEach-Object {{
    $s = $WshShell.CreateShortcut($_.FullName);
    $s.TargetPath = '{exe}';
    $s.WorkingDirectory = '{base}';
    $s.Arguments = '';
    $s.IconLocation = '{ico},0';
    $s.Description = 'Saúde+ Escalas';
    $s.Save();
  }};
}}"#,
            exe = exe_str.replace('\'', "''"),
            ico = ico_str.replace('\'', "''"),
            base = base_str.replace('\'', "''")
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    Some(icon_png_path)
}

const DESKTOP_NOTIFICATION_BRIDGE: &str = r#"
(function() {
  window.__SAUDE_DESKTOP_APP__ = true;
  window.__SAUDE_DESKTOP_VERSION__ = '1.0.1';
  window.__IS_TAURI_DESKTOP = true;

  if (window.__SAUDE_TAURI_BRIDGE__) return;
  window.__SAUDE_TAURI_BRIDGE__ = true;

  const SUPABASE_URL = 'https://qxpqzbswtdfatdrtqhrw.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzYwMjgsImV4cCI6MjA4NTk1MjAyOH0.BYsaBZE_3_doVSbO8D2rF4USqbZ-9_vr4dR-ILjyVlk';
  const SAVED_ACCOUNTS_KEY = 'saude_computer_accounts_v1';

  let seenIds = new Set();
  let initializedFirstCheck = false;
  let currentUserId = null;
  let notifySeq = 0;
  let lastBadgeCount = -1;
  const cleanedUsers = new Set();

  // Remove do banco do Supabase quaisquer inscrições antigas de push do Google Chrome / localhost:5173 / PWA no PC
  async function purgeDesktopBrowserPushSubscriptions(auth) {
    try {
      const targets = [];
      if (auth && auth.userId && auth.token) {
        targets.push({ userId: auth.userId, token: auth.token });
      }
      if (Array.isArray(window.__SAUDE_SAVED_ACCOUNTS__)) {
        window.__SAUDE_SAVED_ACCOUNTS__.forEach(function(a) {
          if (a && a.userId && a.accessToken) {
            targets.push({ userId: a.userId, token: a.accessToken });
          }
        });
      }
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!cleanedUsers.has(t.userId)) {
          cleanedUsers.add(t.userId);
          await fetch(
            SUPABASE_URL + '/rest/v1/push_subscriptions?user_id=eq.' + t.userId,
            {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: 'Bearer ' + t.token
              }
            }
          ).catch(function() {});
        }
      }
    } catch (_) {}
  }

  // Função global acionada pelo Rust quando o usuário clica na notificação do Windows
  window.__SAUDE_NAVIGATE_TO__ = function(targetPath) {
    try {
      const route = (targetPath && targetPath.startsWith('/')) ? targetPath.split('?')[0] : '/';
      try {
        sessionStorage.setItem('saude_pending_notif_route', route);
      } catch (_) {}
      if (window.location.pathname === '/login') {
        sessionStorage.setItem('saude_post_login_redirect', route);
        return;
      }
      if (window.location.pathname !== route) {
        window.history.pushState({}, '', route);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      window.dispatchEvent(new CustomEvent('saude-notification-clicked', { detail: { route: route } }));
    } catch (_) {
      window.location.href = targetPath || '/';
    }
  };

  // Deduz automaticamente a aba do sistema correspondente ao título/mensagem da notificação
  function resolveNotificationRoute(record) {
    try {
      if (record && typeof record.link === 'string' && record.link.startsWith('/')) {
        return record.link;
      }
      const text = ((record && record.title ? record.title : '') + ' ' + (record && record.message ? record.message : '')).toLowerCase();
      if (text.indexOf('folga') !== -1 || text.indexOf('ausência') !== -1 || text.indexOf('licença') !== -1) {
        return '/folgas';
      }
      if (text.indexOf('escala') !== -1 || text.indexOf('plantão') !== -1 || text.indexOf('plantao') !== -1 || text.indexOf('turno') !== -1) {
        return '/escalas';
      }
      if (text.indexOf('transfer') !== -1 || text.indexOf('remanejamento') !== -1) {
        return '/transferencias';
      }
      if (text.indexOf('crédito') !== -1 || text.indexOf('credito') !== -1 || text.indexOf('saldo') !== -1 || text.indexOf('relatório') !== -1) {
        return '/saldo';
      }
      if (text.indexOf('convite') !== -1 || text.indexOf('solicitação de acesso') !== -1 || text.indexOf('solicitou acesso') !== -1) {
        return '/convites';
      }
      if (text.indexOf('profissional') !== -1 || text.indexOf('funcionário') !== -1 || text.indexOf('funcionario') !== -1) {
        return '/funcionarios';
      }
      if (text.indexOf('feriado') !== -1) {
        return '/feriados';
      }
    } catch (_) {}
    return '/';
  }

  function sendToRustToast(title, body, route, badgeCount) {
    try {
      notifySeq++;
      const resolvedRoute = route || resolveNotificationRoute({ title: title, message: body });
      const payload = JSON.stringify({
        seq: notifySeq,
        title: String(title || 'Saúde+'),
        body: String(body || 'Novo aviso no Saúde+'),
        route: String(resolvedRoute || '/'),
        badge: typeof badgeCount === 'number' ? badgeCount : lastBadgeCount
      });
      document.title = '__SAUDE_NOTIFY__:' + payload;
      setTimeout(function() {
        if (document.title.indexOf('__SAUDE_NOTIFY__:') === 0) {
          document.title = 'Saúde+ Escalas';
        }
      }, 150);
    } catch (_) {}
  }

  let pendingBadgeTimer = null;
  function sendBadgeToRust(count) {
    try {
      const n = Math.max(0, parseInt(count, 10) || 0);
      if (n === lastBadgeCount && !pendingBadgeTimer) return;
      if (pendingBadgeTimer) {
        clearTimeout(pendingBadgeTimer);
        pendingBadgeTimer = null;
      }

      const dispatchBadge = function() {
        if (
          document.title.indexOf('__SAUDE_NOTIFY__:') === 0 ||
          document.title.indexOf('__SAUDE_SAVE_ACCOUNTS__:') === 0
        ) {
          pendingBadgeTimer = setTimeout(dispatchBadge, 180);
          return;
        }
        pendingBadgeTimer = null;
        lastBadgeCount = n;
        document.title = '__SAUDE_BADGE__:' + String(n);
        setTimeout(function() {
          if (document.title.indexOf('__SAUDE_BADGE__:') === 0) {
            document.title = 'Saúde+ Escalas';
          }
        }, 100);
      };

      pendingBadgeTimer = setTimeout(dispatchBadge, 60);
    } catch (_) {}
  }

  // Conecta navigator.setAppBadge / clearAppBadge (usado pelo NotificationBell) direto no ícone da Barra de Tarefas!
  try {
    navigator.setAppBadge = function(count) {
      sendBadgeToRust(typeof count === 'number' ? count : 1);
      return Promise.resolve();
    };
    navigator.clearAppBadge = function() {
      sendBadgeToRust(0);
      return Promise.resolve();
    };
  } catch (_) {}

  try {
    const NativeNotification = function(title, options) {
      const opts = options || {};
      const route = (opts.data && opts.data.url) || undefined;
      sendToRustToast(title, opts.body, route);
      this.close = function() {};
      this.onclick = null;
    };
    NativeNotification.permission = 'granted';
    NativeNotification.requestPermission = function(cb) {
      if (typeof cb === 'function') cb('granted');
      return Promise.resolve('granted');
    };
    window.Notification = NativeNotification;

    if ('serviceWorker' in navigator && window.ServiceWorkerRegistration) {
      window.ServiceWorkerRegistration.prototype.showNotification = function(title, options) {
        const opts = options || {};
        const route = (opts.data && opts.data.url) || undefined;
        sendToRustToast(title, opts.body, route);
        return Promise.resolve();
      };
    }
  } catch (_) {}

  function getAuthSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const parsed = JSON.parse(localStorage.getItem(k) || '{}');
          if (parsed && parsed.user && parsed.user.id && parsed.access_token) {
            return {
              userId: parsed.user.id,
              email: parsed.user.email,
              meta: parsed.user.user_metadata || {},
              token: parsed.access_token,
              refreshToken: parsed.refresh_token
            };
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function syncSavedComputerAccounts() {
    try {
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
        if (!Array.isArray(localList)) localList = [];
      } catch (_) { localList = []; }

      if (Array.isArray(window.__SAUDE_SAVED_ACCOUNTS__) && window.__SAUDE_SAVED_ACCOUNTS__.length > 0) {
        const mergedMap = {};
        window.__SAUDE_SAVED_ACCOUNTS__.concat(localList).forEach(function(a) {
          if (a && a.email && a.refreshToken) {
            if (!mergedMap[a.email] || (a.updatedAt || 0) >= (mergedMap[a.email].updatedAt || 0)) {
              mergedMap[a.email] = a;
            }
          }
        });
        localList = Object.values(mergedMap);
      }

      const auth = getAuthSession();
      if (auth && auth.email && auth.refreshToken) {
        const entry = {
          userId: auth.userId,
          email: auth.email,
          name: auth.meta.full_name || auth.meta.name || auth.email.split('@')[0],
          avatarUrl: auth.meta.avatar_url || auth.meta.picture,
          accessToken: auth.token,
          refreshToken: auth.refreshToken,
          updatedAt: Date.now()
        };
        localList = [entry].concat(localList.filter(function(a) { return a && a.email !== entry.email; })).slice(0, 8);
      }

      if (localList.length > 0) {
        window.__SAUDE_SAVED_ACCOUNTS__ = localList;
        localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(localList));
        window.dispatchEvent(new Event('saude-accounts-updated'));
        if (auth) {
          document.title = '__SAUDE_SAVE_ACCOUNTS__:' + JSON.stringify(localList);
          setTimeout(function() {
            if (document.title.indexOf('__SAUDE_SAVE_ACCOUNTS__:') === 0) {
              document.title = 'Saúde+ Escalas';
            }
          }, 100);
        }
      }
    } catch (_) {}
  }

  function handleRecord(record) {
    try {
      if (!record || record.is_read) return;
      const auth = getAuthSession();
      if (!auth) return;
      if (record.user_id && record.user_id !== auth.userId) return;
      if (record.id) {
        if (seenIds.has(record.id)) return;
        seenIds.add(record.id);
      }
      const route = resolveNotificationRoute(record);
      sendToRustToast(
        record.title || 'Saúde+',
        record.message || 'Você recebeu um novo aviso no Saúde+.',
        route
      );
    } catch (_) {}
  }

  const OrigWebSocket = window.WebSocket;
  if (OrigWebSocket) {
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);
      ws.addEventListener('message', function(ev) {
        try {
          if (typeof ev.data !== 'string' || ev.data.indexOf('notifications') === -1) return;
          const msg = JSON.parse(ev.data);
          const payload = msg && msg.payload;
          const data = (payload && payload.data) || payload;
          if (data && data.table === 'notifications' && (data.type === 'INSERT' || data.eventType === 'INSERT')) {
            const record = data.record || data.new;
            if (record) handleRecord(record);
          }
        } catch (_) {}
      });
      return ws;
    };
    window.WebSocket.prototype = OrigWebSocket.prototype;
    window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    window.WebSocket.OPEN = OrigWebSocket.OPEN;
    window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
    window.WebSocket.CLOSED = OrigWebSocket.CLOSED;
  }

  async function pollLatestNotifications() {
    try {
      const auth = getAuthSession();
      if (!auth) {
        if (currentUserId !== null) {
          currentUserId = null;
          seenIds.clear();
          initializedFirstCheck = false;
          sendBadgeToRust(0);
        }
        return;
      }

      if (currentUserId !== auth.userId) {
        currentUserId = auth.userId;
        seenIds.clear();
        initializedFirstCheck = false;
        syncSavedComputerAccounts();
        purgeDesktopBrowserPushSubscriptions(auth);
      }

      const res = await fetch(
        SUPABASE_URL + '/rest/v1/notifications?select=id,user_id,title,message,link,type,is_read,is_global_banner,created_at&user_id=eq.' + auth.userId + '&is_read=eq.false&order=created_at.desc&limit=50',
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + auth.token
          }
        }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows)) return;

      // Atualiza o contador de mensagens não lidas no ícone (estilo WhatsApp), ignorando banners globais
      const normalUnreadCount = rows.filter(function(r) { return r && !r.is_global_banner; }).length;
      sendBadgeToRust(normalUnreadCount);

      if (!initializedFirstCheck) {
        rows.forEach(function(r) { if (r && r.id) seenIds.add(r.id); });
        initializedFirstCheck = true;
        return;
      }

      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r && r.id && !seenIds.has(r.id)) {
          handleRecord(r);
        }
      }
    } catch (_) {}
  }

  window.addEventListener('online', function() {
    setTimeout(pollLatestNotifications, 500);
  });

  setTimeout(syncSavedComputerAccounts, 800);
  setInterval(syncSavedComputerAccounts, 10000);
  setInterval(pollLatestNotifications, 3000);
  setTimeout(pollLatestNotifications, 1500);
})();
"#;

/// Exibe a notificação nativa do Windows com protocolo `saudeplus://nav/<profile><route>`
/// para que, ao clicar nela, o aplicativo abra e vá direto para a aba do que foi notificado!
fn notify_windows(profile_id: u16, title: String, body: String, route: String) {
    std::thread::spawn(move || {
        let icon_opt = ensure_windows_app_identity_and_install(profile_id);
        let display_title = if profile_id > 1 {
            format!("[Conta {}] {}", profile_id, title)
        } else {
            title
        };

        let clean_route = if route.starts_with('/') {
            route
        } else {
            format!("/{}", route)
        };
        let launch_uri = format!("saudeplus://nav/{}{}", profile_id, clean_route);

        let image_xml = if let Some(ref icon_path) = icon_opt {
            if icon_path.exists() {
                format!(
                    r#"<image placement="appLogoOverride" src="file:///{}" alt="Saúde+" />"#,
                    escape_str_attribute(&icon_path.display().to_string())
                )
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        let xml_payload = format!(
            r#"<toast duration="long" activationType="protocol" launch="{launch}">
                <visual>
                    <binding template="ToastGeneric">
                        {img}
                        <text id="1">{t}</text>
                        <text id="2">{b}</text>
                    </binding>
                </visual>
                <actions>
                    <action content="Abrir no Saúde+" arguments="{launch}" activationType="protocol" />
                </actions>
            </toast>"#,
            launch = escape_str_attribute(&launch_uri),
            img = image_xml,
            t = escape_str_attribute(&display_title),
            b = escape_str_attribute(&body),
        );

        let shown_ok = (|| -> windows::runtime::Result<()> {
            let toast_xml = XmlDocument::new()?;
            toast_xml.LoadXml(HSTRING::from(xml_payload))?;
            let toast_template = ToastNotification::CreateToastNotification(toast_xml)?;
            let notifier =
                ToastNotificationManager::CreateToastNotifierWithId(HSTRING::from(APP_AUMID))?;
            notifier.Show(&toast_template)?;
            Ok(())
        })();

        if shown_ok.is_err() {
            let mut fallback = Toast::new(APP_AUMID)
                .title(&display_title)
                .text1(&body)
                .sound(Some(Sound::Default))
                .duration(Duration::Long);

            if let Some(ref icon_path) = icon_opt {
                if icon_path.exists() {
                    fallback = fallback.icon(icon_path, IconCrop::Square, "Saúde+");
                }
            }
            let _ = fallback.show();
        }
    });
}

fn restore_window_and_navigate(app: &tauri::AppHandle, target_route: Option<&str>) {
    let app_clone = app.clone();
    let route_owned = target_route.map(|s| s.to_string());
    let _ = app.run_on_main_thread(move || {
        if let Some(window) = app_clone.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_always_on_top(true);
            let _ = window.set_focus();

            if let Some(ref route) = route_owned {
                let safe_route =
                    serde_json::to_string(route).unwrap_or_else(|_| "\"/\"".to_string());
                let js = format!(
                    "if (window.__SAUDE_NAVIGATE_TO__) {{ window.__SAUDE_NAVIGATE_TO__({}); }} else {{ window.location.href = {}; }}",
                    safe_route, safe_route
                );
                let _ = window.eval(&js);
            }

            let win_clone = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(StdDuration::from_millis(1200));
                let _ = win_clone.set_always_on_top(false);
            });
        }
    });
}

fn spawn_profile_instance(target_profile: u16) {
    if let Ok(current_exe) = std::env::current_exe() {
        let _ = Command::new(current_exe)
            .arg(format!("--profile={}", target_profile))
            .spawn();
    }
}

fn log_step(msg: &str) {
    use std::io::Write;
    let p = get_base_dir().join("startup_trace.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(p) {
        let _ = writeln!(f, "{}", msg);
    }
}

fn main() {
    let base_dir = get_base_dir();
    let _ = std::fs::create_dir_all(&base_dir);
    let _ = std::env::set_current_dir(&base_dir);
    let protocol_nav = parse_protocol_launch_arg();
    let profile_id = get_profile_id();
    let start_minimized = std::env::args().any(|a| a == "--minimized");
    let just_installed = std::env::args().any(|a| a == "--installed");
    log_step(&format!("STEP 1: start profile={}", profile_id));

    let single_instance_port = 47830u16.saturating_add(profile_id);
    let listener = match TcpListener::bind(("127.0.0.1", single_instance_port)) {
        Ok(l) => l,
        Err(_) => {
            let mut handed_off = false;
            if let Ok(mut stream) = TcpStream::connect_timeout(
                &std::net::SocketAddr::from(([127, 0, 0, 1], single_instance_port)),
                StdDuration::from_millis(500),
            ) {
                let _ = stream.set_read_timeout(Some(StdDuration::from_millis(800)));
                let write_res = if let Some((_, ref route)) = protocol_nav {
                    let msg = format!("NAV:{}", route);
                    stream.write_all(msg.as_bytes())
                } else {
                    stream.write_all(b"SHOW")
                };
                if write_res.is_ok() {
                    let _ = stream.flush();
                    let mut ack = [0u8; 8];
                    if let Ok(n) = stream.read(&mut ack) {
                        if n > 0 {
                            handed_off = true;
                        }
                    }
                }
            }
            if handed_off {
                return;
            }
            // Se a instância anterior estava travada e não respondeu ACK, libera a porta e abre normalmente
            std::thread::sleep(StdDuration::from_millis(200));
            match TcpListener::bind(("127.0.0.1", single_instance_port)) {
                Ok(l) => l,
                Err(_) => return,
            }
        }
    };

    let _ = ensure_windows_app_identity_and_install(profile_id);
    log_step("STEP 2: identity ensured, starting tauri::Builder");

    tauri::Builder::default()
        .setup(move |app| {
            log_step("STEP 3: inside tauri setup");
            let app_handle_for_ipc = app.handle().clone();
            std::thread::spawn(move || {
                for stream in listener.incoming().flatten() {
                    let mut s = stream;
                    let _ = s.set_read_timeout(Some(StdDuration::from_millis(800)));
                    let mut buf = [0u8; 4096];
                    if let Ok(n) = s.read(&mut buf) {
                        if n > 0 {
                            let req = String::from_utf8_lossy(&buf[..n]);
                            if let Some(route) = req.strip_prefix("NAV:") {
                                restore_window_and_navigate(
                                    &app_handle_for_ipc,
                                    Some(route.trim()),
                                );
                            } else {
                                restore_window_and_navigate(&app_handle_for_ipc, None);
                            }
                            let _ = s.write_all(b"OK");
                            let _ = s.flush();
                        }
                    }
                }
            });

            let window_title = if profile_id == 1 {
                "Saúde+ Escalas".to_string()
            } else {
                format!("Saúde+ Escalas (Conta {})", profile_id)
            };

            let profile_data_dir = get_base_dir()
                .join("profiles")
                .join(format!("profile_{}", profile_id));
            let _ = std::fs::create_dir_all(&profile_data_dir);
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &profile_data_dir);

            let saved_accs_initial = read_saved_accounts_json().to_string();
            let init_script = format!(
                "window.__SAUDE_SAVED_ACCOUNTS__ = {};\n{}",
                saved_accs_initial, DESKTOP_NOTIFICATION_BRIDGE
            );

            let initial_url = if let Some((_, ref route)) = protocol_nav {
                if route.contains('?') {
                    format!("{}{}&from_notif=1", APP_URL, route)
                } else {
                    format!("{}{}?from_notif=1", APP_URL, route)
                }
            } else {
                APP_URL.to_string()
            };

            let tray_holder: Arc<Mutex<Option<TrayIcon>>> = Arc::new(Mutex::new(None));
            let tray_holder_for_title = tray_holder.clone();
            let app_handle_for_title = app.handle().clone();

            let parsed_url = initial_url.parse().expect("URL inválida");
            let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed_url))
                .title(&window_title)
                .inner_size(1280.0, 820.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .additional_browser_args("--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding")
                .initialization_script(&init_script)
                .on_document_title_changed(move |_window, title| {
                    if let Some(json_str) = title.strip_prefix(NOTIFY_PREFIX) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                            let t = val
                                .get("title")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Saúde+")
                                .to_string();
                            let b = val
                                .get("body")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Novo aviso no Saúde+")
                                .to_string();
                            let r = val
                                .get("route")
                                .and_then(|v| v.as_str())
                                .unwrap_or("/")
                                .to_string();
                            if let Some(badge_num) = val.get("badge").and_then(|v| v.as_i64()) {
                                if badge_num >= 0 {
                                    update_app_badge(
                                        &app_handle_for_title,
                                        &tray_holder_for_title,
                                        profile_id,
                                        badge_num as u32,
                                    );
                                }
                            }
                            notify_windows(profile_id, t, b, r);
                        }
                    } else if let Some(badge_str) = title.strip_prefix(BADGE_PREFIX) {
                        if let Ok(count) = badge_str.trim().parse::<u32>() {
                            update_app_badge(
                                &app_handle_for_title,
                                &tray_holder_for_title,
                                profile_id,
                                count,
                            );
                        }
                    } else if let Some(accs_str) = title.strip_prefix(SAVE_ACCOUNTS_PREFIX) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(accs_str) {
                            let _ = merge_and_save_accounts(&val);
                        }
                    }
                })
                .build()?;
            log_step("STEP 4: window built");

            if start_minimized {
                let _ = main_window.hide();
            } else {
                let _ = main_window.show();
                let _ = main_window.set_always_on_top(true);
                let _ = main_window.set_focus();
                let win_for_top = main_window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(StdDuration::from_millis(1500));
                    let _ = win_for_top.set_always_on_top(false);
                });
            }

            if just_installed {
                notify_windows(
                    profile_id,
                    "✅ Saúde+ Instalado com Sucesso!".to_string(),
                    "O aplicativo foi fixado na Barra de Tarefas, Área de Trabalho e as notificações estão ativas.".to_string(),
                    "/".to_string(),
                );
            }

            let window_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            let open_label = if profile_id == 1 {
                "Abrir Saúde+ Escalas".to_string()
            } else {
                format!("Abrir Saúde+ Escalas (Conta {})", profile_id)
            };

            let open_item = MenuItem::with_id(app, "open", &open_label, true, None::<&str>)?;
            let test_item = MenuItem::with_id(app, "test", "Testar Notificação do Windows", true, None::<&str>)?;
            let p2_item = MenuItem::with_id(app, "p2", "Abrir Conta 2 (Teste)", true, None::<&str>)?;
            let p3_item = MenuItem::with_id(app, "p3", "Abrir Conta 3 (Teste)", true, None::<&str>)?;
            let p4_item = MenuItem::with_id(app, "p4", "Abrir Conta 4 (Teste)", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Manter em 2º plano na Gaveta", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&open_item, &test_item, &p2_item, &p3_item, &p4_item, &hide_item],
            )?;

            let tray_tooltip = if profile_id == 1 {
                "Saúde+ Escalas (Ativo na gaveta)".to_string()
            } else {
                format!("Saúde+ Escalas - Conta {} (Ativo na gaveta)", profile_id)
            };

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip(&tray_tooltip)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => restore_window_and_navigate(app, None),
                    "test" => notify_windows(
                        profile_id,
                        "🔔 Novo Pedido de Folga".to_string(),
                        "Clique nesta notificação para abrir o Saúde+ Escalas diretamente na aba de Pedidos de Folga!".to_string(),
                        "/folgas".to_string(),
                    ),
                    "p2" => spawn_profile_instance(2),
                    "p3" => spawn_profile_instance(3),
                    "p4" => spawn_profile_instance(4),
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_window_and_navigate(tray.app_handle(), None);
                    }
                });

            if let Ok(embedded_img) = Image::from_bytes(EMBEDDED_ICON_PNG) {
                tray_builder = tray_builder.icon(embedded_img);
            } else if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let built_tray = tray_builder.build(app)?;
            if let Ok(mut guard) = tray_holder.lock() {
                *guard = Some(built_tray);
            }
            app.manage(tray_holder);
            log_step("STEP 5: tray built, setup done");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Erro ao construir o aplicativo desktop Saúde+ Escalas")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                // Garante que o aplicativo nunca saia da gaveta do Windows (System Tray)
                api.prevent_exit();
            }
        });
}
