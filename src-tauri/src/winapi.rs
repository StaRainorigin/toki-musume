use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    GetMessageW, PostThreadMessageW,
    EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT,
    MSG, WM_QUIT,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent};
use windows::Win32::System::SystemInformation::GetTickCount64;
use windows::Win32::Foundation::{HWND, WPARAM, LPARAM};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundWindowInfo {
    pub process_name: String,
    pub window_title: String,
    pub pid: u32,
}

/// 获取前台窗口信息（保留供 poll/debug 调用）
pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        foreground_info_for(hwnd)
    }
}

/// 根据 HWND 获取窗口信息（共享函数）
fn foreground_info_for(hwnd: HWND) -> Option<ForegroundWindowInfo> {
    unsafe {
        // 窗口标题
        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = String::from_utf16_lossy(&title_buf[..len as usize]);

        // pid
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        // 进程名
        let process_name = get_process_name(pid).unwrap_or_else(|_| String::from("unknown"));

        Some(ForegroundWindowInfo {
            process_name,
            window_title,
            pid,
        })
    }
}

/// 通过 pid 获取进程名
fn get_process_name(pid: u32) -> Result<String, String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {}", e))?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == pid {
                    let name = String::from_utf16_lossy(
                        &entry.szExeFile.iter().take_while(|&&c| c != 0).cloned().collect::<Vec<_>>(),
                    );
                    return Ok(name);
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        Err(String::from("process not found"))
    }
}

/// 获取最后输入至今的毫秒数（用于空闲检测）
pub fn get_idle_ms() -> u64 {
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut lii).as_bool() {
            let now = GetTickCount64();
            let last = lii.dwTime as u64;
            let now32 = (now & 0xFFFFFFFF) as u64;
            if now32 >= last {
                now32 - last
            } else {
                (0xFFFFFFFF - last) + now32
            }
        } else {
            0
        }
    }
}

// ===== SetWinEventHook 事件钩子 =====

static HOOK_THREAD_ID: AtomicUsize = AtomicUsize::new(0);
static HOOK_HANDLE: Mutex<Option<isize>> = Mutex::new(None);

/// 事件回调的上下文（需要 AppHandle 来 emit 事件）
/// 用 thread-local 或全局存储不行，因为 WINEVENTPROC 是裸函数指针。
/// 改用全局 AppHandle 存储。
static APP_HANDLE: Mutex<Option<tauri::AppHandle>> = Mutex::new(None);

/// 启动前台窗口事件钩子
pub fn start_foreground_hook(app: tauri::AppHandle) -> Result<(), String> {
    // 存储 AppHandle 供回调使用
    *APP_HANDLE.lock().map_err(|e| format!("锁失败: {}", e))? = Some(app);

    // 如果已有线程在运行，不重复启动
    if HOOK_THREAD_ID.load(Ordering::SeqCst) != 0 {
        return Ok(());
    }

    std::thread::spawn(|| {
        unsafe {
            let thread_id = windows::Win32::System::Threading::GetCurrentThreadId();
            HOOK_THREAD_ID.store(thread_id as usize, Ordering::SeqCst);
            // 注册事件钩子：监听前台窗口切换
            let hook = SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                None,
                Some(win_event_callback),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            );

            if hook.is_invalid() {
                eprintln!("[winapi] SetWinEventHook 失败");
                HOOK_THREAD_ID.store(0, Ordering::SeqCst);
                return;
            }

            // 存储 hook handle
            if let Ok(mut h) = HOOK_HANDLE.lock() {
                *h = Some(hook.0 as isize);
            }

            // 消息循环（out-of-context hook 必须 pump 消息）
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                // 消息由系统分发到回调
            }

            // 清理
            let _ = UnhookWinEvent(hook);
            if let Ok(mut h) = HOOK_HANDLE.lock() {
                *h = None;
            }
        }

        HOOK_THREAD_ID.store(0, Ordering::SeqCst);
    });

    Ok(())
}

/// 停止前台窗口事件钩子
pub fn stop_foreground_hook() -> Result<(), String> {
    let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
    if thread_id == 0 {
        return Ok(());
    }

    // 发送 WM_QUIT 让线程退出消息循环
    unsafe {
        let _ = PostThreadMessageW(
            thread_id as u32,
            WM_QUIT,
            WPARAM(0),
            LPARAM(0),
        );
    }

    HOOK_THREAD_ID.store(0, Ordering::SeqCst);
    if let Ok(mut h) = HOOK_HANDLE.lock() {
        *h = None;
    }
    if let Ok(mut a) = APP_HANDLE.lock() {
        *a = None;
    }
    Ok(())
}

/// WINEVENTPROC 回调函数
unsafe extern "system" fn win_event_callback(
    _h_win_event_hook: windows::Win32::UI::Accessibility::HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _dw_event_thread: u32,
    _dwms_event_time: u32,
) {
    // 获取窗口信息
    if let Some(info) = foreground_info_for(hwnd) {
        // 通过 AppHandle emit 事件给前端
        if let Ok(handle) = APP_HANDLE.lock() {
            if let Some(app) = handle.as_ref() {
                use tauri::Emitter;
                let _ = app.emit("foreground_window_changed", &info);
            }
        }
    }
}
