use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};
use windows::Win32::System::SystemInformation::GetTickCount64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundWindowInfo {
    pub process_name: String,
    pub window_title: String,
    pub pid: u32,
}

/// 获取前台窗口的进程名、标题、pid
pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        // 窗口标题
        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = String::from_utf16_lossy(&title_buf[..len as usize]);

        // pid
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        // 进程名：通过 process snapshot 获取
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
            // GetLastInputInfo 返回的是 GetTickCount 的值（32位），做差处理
            let last = lii.dwTime as u64;
            let now32 = (now & 0xFFFFFFFF) as u64;
            if now32 >= last {
                now32 - last
            } else {
                // 32 位回绕
                (0xFFFFFFFF - last) + now32
            }
        } else {
            0
        }
    }
}
