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

// ===== 截屏 + OCR =====

/// 截取前台窗口并 OCR，返回识别到的文字
pub fn capture_and_ocr() -> Result<String, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err("无前台窗口".to_string());
        }

        // 获取窗口区域
        let mut rect = windows::Win32::Foundation::RECT::default();
        windows::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rect)
            .map_err(|e| format!("GetWindowRect 失败: {}", e))?;

        let width = (rect.right - rect.left).max(1) as usize;
        let height = (rect.bottom - rect.top).max(1) as usize;

        // 截屏
        let png_bytes = capture_region(rect.left, rect.top, width, height)?;

        // OCR
        ocr_png(&png_bytes)
    }
}

/// 截取屏幕指定区域，返回 PNG bytes
fn capture_region(x: i32, y: i32, width: usize, height: usize) -> Result<Vec<u8>, String> {
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Foundation::HWND;

    unsafe {
        let hdc_screen = GetDC(HWND::default());
        if hdc_screen.is_invalid() {
            return Err("GetDC 失败".to_string());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("CreateCompatibleDC 失败".to_string());
        }

        let hbitmap = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
        if hbitmap.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("CreateCompatibleBitmap 失败".to_string());
        }

        let old_obj = SelectObject(hdc_mem, hbitmap);

        // 截图
        let ok = BitBlt(hdc_mem, 0, 0, width as i32, height as i32, hdc_screen, x, y, SRCCOPY);
        if ok.is_err() {
            SelectObject(hdc_mem, old_obj);
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("BitBlt 失败".to_string());
        }

        // 获取像素数据
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32), // 负值 = top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0, // BI_RGB
                ..Default::default()
            },
            ..Default::default()
        };

        let mut pixels = vec![0u8; width * height * 4];
        let result = GetDIBits(hdc_mem, hbitmap, 0, height as u32, Some(pixels.as_mut_ptr() as *mut _), &mut bmi, DIB_RGB_COLORS);

        // 清理 GDI 资源
        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbitmap);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(HWND::default(), hdc_screen);

        if result == 0 {
            return Err("GetDIBits 失败".to_string());
        }

        // 转换 BGRA → RGBA 并编码为 PNG
        let mut rgba = vec![0u8; width * height * 4];
        for i in (0..pixels.len()).step_by(4) {
            rgba[i] = pixels[i + 2];     // R
            rgba[i + 1] = pixels[i + 1]; // G
            rgba[i + 2] = pixels[i];     // B
            rgba[i + 3] = pixels[i + 3]; // A
        }

        let img = image::RgbaImage::from_raw(width as u32, height as u32, rgba)
            .ok_or("创建图像失败")?;

        let mut png_buf = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut png_buf), image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;

        Ok(png_buf)
    }
}

/// 用 WinRT OCR 识别 PNG 图片中的文字
fn ocr_png(png_bytes: &[u8]) -> Result<String, String> {
    use windows::Media::Ocr::OcrEngine;
    use windows::Graphics::Imaging::BitmapDecoder;

    // 创建内存流
    let stream = windows::Storage::Streams::InMemoryRandomAccessStream::new()
        .map_err(|e| format!("创建流失败: {}", e))?;

    let writer = windows::Storage::Streams::DataWriter::CreateDataWriter(&stream)
        .map_err(|e| format!("创建 DataWriter 失败: {}", e))?;
    writer.WriteBytes(png_bytes)
        .map_err(|e| format!("写入字节失败: {}", e))?;
    writer.StoreAsync()
        .map_err(|e| format!("StoreAsync 失败: {}", e))?
        .get()
        .map_err(|e| format!("StoreAsync get 失败: {}", e))?;
    writer.FlushAsync()
        .map_err(|e| format!("FlushAsync 失败: {}", e))?
        .get()
        .map_err(|e| format!("FlushAsync get 失败: {}", e))?;
    stream.Seek(0)
        .map_err(|e| format!("Seek 失败: {}", e))?;

    // 解码图片
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("BitmapDecoder 失败: {}", e))?
        .get()
        .map_err(|e| format!("Decoder get 失败: {}", e))?;

    let bitmap = decoder.GetSoftwareBitmapAsync()
        .map_err(|e| format!("GetSoftwareBitmap 失败: {}", e))?
        .get()
        .map_err(|e| format!("Bitmap get 失败: {}", e))?;

    // 创建 OCR 引擎（使用系统默认语言）
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("创建 OcrEngine 失败: {}", e))?;

    // 识别
    let result = engine.RecognizeAsync(&bitmap)
        .map_err(|e| format!("RecognizeAsync 失败: {}", e))?
        .get()
        .map_err(|e| format!("Recognize get 失败: {}", e))?;

    let text = result.Text()
        .map_err(|e| format!("获取文本失败: {}", e))?;

    Ok(text.to_string())
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
