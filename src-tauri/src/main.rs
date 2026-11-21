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
const CREATE_NO_WINDOW: u32 = 0x08000000;
const EMBEDDED_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");
const EMBEDDED_ICON_ICO: &[u8] = include_bytes!("../icons/icon.ico");

/// Identifica qual perfil (1, 2, 3, 4...) foi solicitado via argumento `--profile=N`
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

/// Garante que o executável, ícones, registro de identidade de notificação,
/// atalhos na Área de Trabalho / Menu Iniciar e inicialização com o Windows estejam configurados.
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

        // Iniciar junto com o Windows (HKCU\...\Run)
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
            return { userId: parsed.user.id, token: parsed.access_token };
          }
        }
      }
    } catch (_) {}
    return null;
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

/// Força a janela a vir para a frente de todas as janelas do Windows (inclusive navegador maximizado)
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
                    let _ = s.set_read_timeout(Some(StdDuration::from_millis(500)));
                    let mut buf = [0u8; 256];
                    if let Ok(n) = s.read(&mut buf) {
                        if n > 0 {
                            let req = String::from_utf8_lossy(&buf[..n]);
                            if req.starts_with("GET ") || req.starts_with("OPTIONS ") {
                                let resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nContent-Type: application/json\r\nContent-Length: 18\r\nConnection: close\r\n\r\n{\"installed\":true}";
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

            let parsed_url = APP_URL.parse().expect("URL inválida");
            let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed_url))
                .title(&window_title)
                .inner_size(1280.0, 820.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .additional_browser_args("--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding")
                .initialization_script(DESKTOP_NOTIFICATION_BRIDGE)
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
                    }
                })
                .build()?;
            log_step("STEP 4: window built");

            // Desliga o always_on_top 1.5s após abrir na frente do navegador
            if !start_minimized {
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
                    "O aplicativo foi instalado na sua Área de Trabalho e as notificações já estão ativas.".to_string(),
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
