use sysinfo::{System, ProcessExt, SystemExt};
use std::path::PathBuf;
use std::ptr::null_mut;
use widestring::U16CString;
use winapi::um::handleapi::CloseHandle;
use winapi::um::minwinbase::LPSECURITY_ATTRIBUTES;
use winapi::um::processthreadsapi::{CreateProcessW, PROCESS_INFORMATION, STARTUPINFOW, ResumeThread};
use winapi::um::winbase::{CREATE_SUSPENDED, CREATE_NO_WINDOW};

pub struct SuspendedProcess {
    pub pid: u32,
    pub thread_handle: Option<winapi::um::winnt::HANDLE>,
}

unsafe impl Send for SuspendedProcess {}

impl SuspendedProcess {
    pub fn resume(&self) -> Result<(), String> {
        if let Some(handle) = self.thread_handle {
            unsafe {
                if ResumeThread(handle) == u32::MAX {
                    return Err("Failed to resume thread".to_string());
                }
                CloseHandle(handle);
            }
        }
        Ok(())
    }
}

fn start_internal(
    process_path: PathBuf,
    suspended: bool,
    args: Option<String>,
    no_window: bool,
) -> Result<PROCESS_INFORMATION, String> {
    if !process_path.exists() {
        return Err(format!("Process path does not exist: {:?}", process_path));
    }

    let process_folder = process_path.parent().ok_or_else(|| {
        format!(
            "Failed to get parent directory of process path: {:?}",
            process_path
        )
    })?;
    let process_folder_wide = U16CString::from_str(process_folder.to_str().unwrap_or(""))
        .map_err(|e| format!("Failed to convert path to wide string: {}", e))?;
    let process_path_str = process_path
        .to_str()
        .ok_or_else(|| format!("Failed to convert path to string: {:?}", process_path))?;
    let application_name = U16CString::from_str(process_path_str)
        .map_err(|e| format!("Failed to convert path to wide string: {}", e))?;
    
    // Command line must include the executable path as the first argument
    let cmd_line_str = if let Some(a) = args {
        format!("\"{}\" {}", process_path_str, a)
    } else {
        format!("\"{}\"", process_path_str)
    };
    
    let cmd_line_wide = U16CString::from_str(&cmd_line_str)
        .map_err(|e| format!("Failed to convert command line to wide string: {}", e))?;
    let cmd_line_ptr = cmd_line_wide.into_raw();

    let mut startup_info: STARTUPINFOW = unsafe { std::mem::zeroed() };
    startup_info.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

    let mut creation_flags = 0;
    if suspended {
        creation_flags |= CREATE_SUSPENDED;
    }
    if no_window {
        creation_flags |= CREATE_NO_WINDOW;
    }

    let success = unsafe {
        CreateProcessW(
            application_name.as_ptr(),
            cmd_line_ptr,
            null_mut() as LPSECURITY_ATTRIBUTES,
            null_mut() as LPSECURITY_ATTRIBUTES,
            0,
            creation_flags,
            null_mut(),
            process_folder_wide.as_ptr(),
            &mut startup_info,
            &mut process_info,
        )
    };

    // Reclaim ownership of the raw pointer to ensure it gets dropped properly
    unsafe {
        let _ = U16CString::from_raw(cmd_line_ptr);
    }

    if success == 0 {
        let error_code = unsafe { winapi::um::errhandlingapi::GetLastError() };
        let error_message = format!("Failed to create process: {}", error_code);
        return Err(error_message);
    }

    Ok(process_info)
}

pub fn start_suspended(process_path: PathBuf) -> Result<u32, String> {
    // EAC and Launcher background processes should have no window
    let info = start_internal(process_path, true, None, true)?;
    unsafe {
        CloseHandle(info.hProcess);
        CloseHandle(info.hThread);
    }
    Ok(info.dwProcessId)
}

pub fn start_suspended_with_args(process_path: PathBuf, args: Vec<String>) -> Result<SuspendedProcess, String> {
    let args_str = args.join(" ");
    let info = start_internal(process_path, true, Some(args_str), false)?;
    
    Ok(SuspendedProcess {
        pid: info.dwProcessId,
        thread_handle: Some(info.hThread),
    })
}

pub fn start_with_args(process_path: PathBuf, args: Vec<String>) -> Result<u32, String> {
    let args_str = args.join(" ");
    // Allow window for the game process (no_window = false)
    let info = start_internal(process_path, false, Some(args_str), false)?;
    unsafe {
        CloseHandle(info.hProcess);
        CloseHandle(info.hThread);
    }
    Ok(info.dwProcessId)
}

pub fn kill_all(names: &[&str]) -> Result<(), String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    for (_pid, process) in sys.processes() {
        if names.contains(&process.name()) {
            process.kill();
        }
    }
    Ok(())
}
