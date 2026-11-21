// Oculta a janela de console preta no Windows em modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration as StdDuration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use winrt_notification::{Duration, IconCrop, Sound, Toast};

const APP_URL: &str = "https://saude-gules.vercel.app";
const APP_AUMID: &str = "com.saudeplus.desktop";
const NOTIFY_PREFIX: &str = "__SAUDE_NOTIFY__:";
const SAVE_ACCOUNTS_PREFIX: &str = "__SAUDE_SAVE_ACCOUNTS__:";
const CREATE_NO_WINDOW: u32 = 0x08000000;
const EMBEDDED_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");
const EMBEDDED_ICON_ICO: &[u8] = include_bytes!("../icons/icon.ico");

fn get_profile_id() -> u16 {
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
            "Saúde+ - Gestão de Escalas",
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

    if profile_id == 1 && installed_exe_path.exists() {
        let exe_str = installed_exe_path.to_string_lossy().to_string();
        let ico_str = icon_ico_path.to_string_lossy().to_string();

        let run_cmd = format!("\"{}\" --minimized", exe_str);
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

        // Garante atalho na Área de Trabalho, Menu Iniciar e Barra de Tarefas
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

    Some(icon_png_path)
}

const DESKTOP_NOTIFICATION_BRIDGE: &str = r#"
(function() {
  window.__SAUDE_DESKTOP_APP__ = true;
  window.__SAUDE_DESKTOP_VERSION__ = '1.0.0';
  window.__IS_TAURI_DESKTOP = true;

  if (window.__SAUDE_TAURI_BRIDGE__) return;
  window.__SAUDE_TAURI_BRIDGE__ = true;

  const SUPABASE_URL = 'https://qxpqzbswtdfatdrtqhrw.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzYwMjgsImV4cCI6MjA4NTk1MjAyOH0.BYsaBZE_3_doVSbO8D2rF4USqbZ-9_vr4dR-ILjyVlk';
  const SAVED_ACCOUNTS_KEY = 'saude_computer_accounts_v1';

  const seenIds = new Set();
  let initializedFirstCheck = false;
  let currentUserId = null;
  let notifySeq = 0;

  function sendToRustToast(title, body) {
    try {
      notifySeq++;
      const payload = JSON.stringify({
        seq: notifySeq,
        title: String(title || 'Saúde+'),
        body: String(body || 'Novo aviso no Saúde+')
      });
      document.title = '__SAUDE_NOTIFY__:' + payload;
      setTimeout(function() {
        if (document.title.indexOf('__SAUDE_NOTIFY__:') === 0) {
          document.title = 'Saúde+ - Gestão de Escalas';
        }
      }, 120);
    } catch (_) {}
  }

  try {
    const NativeNotification = function(title, options) {
      const opts = options || {};
      sendToRustToast(title, opts.body);
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
        sendToRustToast(title, opts.body);
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

  // Sincroniza contas reconhecidas neste computador via canal interno Tauri (sem pedir permissão de rede no navegador!)
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
              document.title = 'Saúde+ - Gestão de Escalas';
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
      sendToRustToast(
        record.title || 'Saúde+',
        record.message || 'Você recebeu um novo aviso no Saúde+.'
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
        }
        return;
      }

      if (currentUserId !== auth.userId) {
        currentUserId = auth.userId;
        seenIds.clear();
        initializedFirstCheck = false;
        syncSavedComputerAccounts();
      }

      const res = await fetch(
        SUPABASE_URL + '/rest/v1/notifications?select=id,user_id,title,message,is_read,created_at&user_id=eq.' + auth.userId + '&is_read=eq.false&order=created_at.desc&limit=5',
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

fn notify_windows(profile_id: u16, title: String, body: String) {
    std::thread::spawn(move || {
        let icon_opt = ensure_windows_app_identity_and_install(profile_id);
        let display_title = if profile_id > 1 {
            format!("[Conta {}] {}", profile_id, title)
        } else {
            title
        };

        let mut toast = Toast::new(APP_AUMID)
            .title(&display_title)
            .text1(&body)
            .sound(Some(Sound::Default))
            .duration(Duration::Long);

        if let Some(ref icon_path) = icon_opt {
            if icon_path.exists() {
                toast = toast.icon(icon_path, IconCrop::Square, "Saúde+");
            }
        }

        if toast.show().is_err() {
            let _ = Toast::new(Toast::POWERSHELL_APP_ID)
                .title(&display_title)
                .text1(&body)
                .sound(Some(Sound::Default))
                .duration(Duration::Long)
                .show();
        }
    });
}

fn restore_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        let win_clone = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(StdDuration::from_millis(1200));
            let _ = win_clone.set_always_on_top(false);
        });
    }
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
    let profile_id = get_profile_id();
    let start_minimized = std::env::args().any(|a| a == "--minimized");
    let just_installed = std::env::args().any(|a| a == "--installed");
    log_step(&format!("STEP 1: start profile={}", profile_id));

    let single_instance_port = 47830u16.saturating_add(profile_id);
    let listener = match TcpListener::bind(("127.0.0.1", single_instance_port)) {
        Ok(l) => l,
        Err(_) => {
            if let Ok(mut stream) = TcpStream::connect_timeout(
                &std::net::SocketAddr::from(([127, 0, 0, 1], single_instance_port)),
                StdDuration::from_millis(400),
            ) {
                let _ = stream.write_all(b"SHOW");
            }
            return;
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
                    let mut buf = [0u8; 32768];
                    if let Ok(n) = s.read(&mut buf) {
                        if n > 0 {
                            let req = String::from_utf8_lossy(&buf[..n]);
                            if req.starts_with("OPTIONS ") {
                                let resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                                let _ = s.write_all(resp.as_bytes());
                                let _ = s.flush();
                            } else if req.starts_with("GET /accounts") || req.starts_with("GET /ping") {
                                let accounts = read_saved_accounts_json();
                                let body_str = serde_json::json!({
                                    "installed": true,
                                    "accounts": accounts
                                })
                                .to_string();
                                let resp = format!(
                                    "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                    body_str.len(),
                                    body_str
                                );
                                let _ = s.write_all(resp.as_bytes());
                                let _ = s.flush();
                            } else if req.starts_with("POST /sync-auth") {
                                let should_show = req.lines().next().unwrap_or("").contains("show=1");
                                let mut merged = read_saved_accounts_json();
                                if let Some(body_idx) = req.find("\r\n\r\n") {
                                    let body_part = &req[body_idx + 4..];
                                    if let Ok(json_body) = serde_json::from_str::<serde_json::Value>(body_part) {
                                        if let Some(accs) = json_body.get("accounts") {
                                            merged = merge_and_save_accounts(accs);
                                        }
                                        // Se o navegador mandou a sessão logada ativa, injeta no App Desktop
                                        if let Some(active_tok) = json_body.get("activeToken") {
                                            if let (Some(k), Some(v)) = (
                                                active_tok.get("key").and_then(|x| x.as_str()),
                                                active_tok.get("value").and_then(|x| x.as_str()),
                                            ) {
                                                if let Some(win) = app_handle_for_ipc.get_webview_window("main") {
                                                    let merged_str = merged.to_string();
                                                    let js = format!(
                                                        r#"(function() {{
                                                          try {{
                                                            localStorage.setItem('saude_computer_accounts_v1', {accs});
                                                            window.__SAUDE_SAVED_ACCOUNTS__ = {accs_raw};
                                                            if (!localStorage.getItem({k})) {{
                                                              localStorage.setItem({k}, {v});
                                                              if (window.location.pathname === '/login') {{
                                                                window.location.replace('/');
                                                              }}
                                                            }}
                                                          }} catch(_) {{}}
                                                        }})();"#,
                                                        accs = serde_json::to_string(&merged_str).unwrap_or_else(|_| "\"[]\"".to_string()),
                                                        accs_raw = merged_str,
                                                        k = serde_json::to_string(k).unwrap_or_else(|_| "\"\"".to_string()),
                                                        v = serde_json::to_string(v).unwrap_or_else(|_| "\"\"".to_string())
                                                    );
                                                    let _ = win.eval(&js);
                                                }
                                            }
                                        }
                                    }
                                }
                                if should_show {
                                    restore_window(&app_handle_for_ipc);
                                }
                                let body_str = serde_json::json!({
                                    "installed": true,
                                    "accounts": merged
                                })
                                .to_string();
                                let resp = format!(
                                    "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                    body_str.len(),
                                    body_str
                                );
                                let _ = s.write_all(resp.as_bytes());
                                let _ = s.flush();
                            } else {
                                restore_window(&app_handle_for_ipc);
                            }
                        }
                    }
                }
            });

            let window_title = if profile_id == 1 {
                "Saúde+ - Gestão de Escalas".to_string()
            } else {
                format!("Saúde+ - Gestão de Escalas (Conta {})", profile_id)
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

            let parsed_url = APP_URL.parse().expect("URL inválida");
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
                            notify_windows(profile_id, t, b);
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
                );
            }

            let window_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Ao clicar no X: fecha a janela e mantém rodando na gaveta do relógio e notificando!
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            let open_label = if profile_id == 1 {
                "Abrir Saúde+".to_string()
            } else {
                format!("Abrir Saúde+ (Conta {})", profile_id)
            };

            let open_item = MenuItem::with_id(app, "open", &open_label, true, None::<&str>)?;
            let test_item = MenuItem::with_id(app, "test", "Testar Notificação do Windows", true, None::<&str>)?;
            let p2_item = MenuItem::with_id(app, "p2", "Abrir Conta 2 (Teste)", true, None::<&str>)?;
            let p3_item = MenuItem::with_id(app, "p3", "Abrir Conta 3 (Teste)", true, None::<&str>)?;
            let p4_item = MenuItem::with_id(app, "p4", "Abrir Conta 4 (Teste)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Sair completamente", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&open_item, &test_item, &p2_item, &p3_item, &p4_item, &quit_item],
            )?;

            let tray_tooltip = if profile_id == 1 {
                "Saúde+ (Rodando em segundo plano)".to_string()
            } else {
                format!("Saúde+ - Conta {} (Rodando em segundo plano)", profile_id)
            };

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip(&tray_tooltip)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => restore_window(app),
                    "test" => notify_windows(
                        profile_id,
                        "🔔 Saúde+ Desktop Ativo".to_string(),
                        "As notificações em segundo plano na gaveta do Windows estão funcionando!".to_string(),
                    ),
                    "p2" => spawn_profile_instance(2),
                    "p3" => spawn_profile_instance(3),
                    "p4" => spawn_profile_instance(4),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;
            log_step("STEP 5: tray built, setup done");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o aplicativo desktop Saúde+");
}
